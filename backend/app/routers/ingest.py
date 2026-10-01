import hmac
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.news import NewsCard
from app.models.push import PushHistory
from app.services.push_service import PushService

router = APIRouter()


class DigestCard(BaseModel):
    story_id: str = Field(min_length=4, max_length=200)
    title: str = Field(min_length=1, max_length=500)
    summary: str = ""
    category: Union[Literal["tech", "finance", "politics"], str] = "tech"
    source: str = "未知来源"
    source_url: str
    ai_value_score: float = Field(default=50, ge=0, le=100)
    heat_score: float = Field(default=50, ge=0, le=100)
    interest_tags: List[str] = Field(default_factory=list)
    continuity: Optional[str] = None
    source_count: int = 1
    corroborating_sources: List[str] = Field(default_factory=list)
    evidence_urls: List[str] = Field(default_factory=list)
    score_breakdown: Optional[Dict[str, Any]] = None
    selection_reasons: List[str] = Field(default_factory=list)
    career_lens: str = ""


class DigestReport(BaseModel):
    headline: str = "NEXUS 每日知识简报"
    overview: str = ""
    cross_domain_insight: str = ""
    career_signals: List[str] = Field(default_factory=list)
    watch_items: List[Dict[str, Any]] = Field(default_factory=list)


class DigestImport(BaseModel):
    schema_version: str
    date: str
    report: DigestReport
    cards: List[DigestCard] = Field(max_length=100)
    push_to_feishu: bool = True


CATEGORY_MAP = {
    "tech": "AI产业",
    "finance": "金融商业",
    "politics": "宏观国际",
}


def _verify_token(value: str) -> None:
    expected = settings.NEXUS_INGEST_TOKEN
    if not expected:
        raise HTTPException(status_code=503, detail="NEXUS 导入令牌尚未配置")
    if not hmac.compare_digest(value, expected):
        raise HTTPException(status_code=401, detail="导入令牌无效")


@router.post("/digest")
async def import_digest(
    payload: DigestImport,
    x_nexus_ingest_token: str = Header(default=""),
):
    """Idempotently import locally generated cards, then push the new batch to Feishu."""
    _verify_token(x_nexus_ingest_token)
    try:
        published_at = datetime.fromisoformat(payload.date)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="date 必须是 YYYY-MM-DD") from error

    created: List[NewsCard] = []
    updated = 0
    async with async_session() as db:
        for incoming in payload.cards:
            existing = (
                await db.execute(select(NewsCard).where(NewsCard.source_id == incoming.story_id))
            ).scalars().first()
            tags = list(dict.fromkeys([
                *incoming.interest_tags,
                incoming.continuity or "",
                f"{incoming.source_count}源覆盖" if incoming.source_count > 1 else "单源待验证",
            ]))
            tags = [tag for tag in tags if tag][:8]
            values = {
                "title": incoming.title,
                "summary": incoming.summary,
                "category": CATEGORY_MAP.get(incoming.category, incoming.category),
                "source": incoming.source,
                "source_url": incoming.source_url,
                "source_id": incoming.story_id,
                "heat_score": incoming.heat_score,
                "ai_value_score": incoming.ai_value_score,
                "interest_tags": tags,
                "published_at": published_at,
            }
            if existing:
                for key, value in values.items():
                    setattr(existing, key, value)
                updated += 1
            else:
                card = NewsCard(**values)
                db.add(card)
                created.append(card)
        await db.commit()
        for card in created:
            await db.refresh(card)

    feishu_status = "skipped"
    feishu_message = (
        "本次请求关闭了飞书推送"
        if not payload.push_to_feishu
        else "没有新卡片，避免重复推送"
    )
    if payload.push_to_feishu and created:
        ok, feishu_message = await PushService().send_feishu_digest(
            created,
            payload.report.headline,
            payload.report.overview,
            payload.date,
        )
        feishu_status = "success" if ok else "failed"
        async with async_session() as db:
            db.add(PushHistory(
                trigger_type="local_ollama_import",
                push_channel="feishu",
                status=feishu_status,
                news_count=len(created),
                recipient_count=1,
                success_count=1 if ok else 0,
                failed_count=0 if ok else 1,
                title=payload.report.headline,
                summary=payload.report.overview,
                news_card_ids=[card.id for card in created],
                error_message=None if ok else feishu_message,
                sent_at=datetime.utcnow(),
            ))
            await db.commit()

    return {
        "status": "ok",
        "created": len(created),
        "updated": updated,
        "feishu": feishu_status,
        "message": feishu_message,
    }
