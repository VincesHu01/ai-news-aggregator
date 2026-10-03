import asyncio
import hmac
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.database import async_session
from app.models.news import NewsCard
from app.models.push import PushHistory
from app.services.push_service import PushService
from app.services.control_service import get_delivery_control, set_delivery_enabled

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
    key_facts: List[str] = Field(default_factory=list)
    background: str = ""
    why_it_matters: str = ""
    glossary: List[Dict[str, str]] = Field(default_factory=list)
    analysis_sections: List[Dict[str, Any]] = Field(default_factory=list)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)
    stakeholders: List[Dict[str, Any]] = Field(default_factory=list)
    visual_direction: Dict[str, Any] = Field(default_factory=dict)
    topic_tag: str = ""
    cover_image: Optional[str] = None


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


class InternalControlUpdate(BaseModel):
    enabled: bool


CATEGORY_MAP = {
    "tech": "AI产业",
    "finance": "金融商业",
    "politics": "宏观国际",
}

GENERIC_TAGS = {"ai", "人工智能", "科技", "新闻", "金融", "商业", "宏观", "国际", "new", "developing"}


def _single_topic_tag(incoming: DigestCard) -> str:
    tag = str(incoming.topic_tag or "").strip().lstrip("#")
    if tag and tag.lower() not in GENERIC_TAGS:
        return tag[:24]
    # Older exports did not have a per-story tag. Derive one narrow topic from
    # the actual story instead of falling back to broad labels such as "AI".
    text = f"{incoming.title} {incoming.summary} {incoming.source}".lower()
    keyword_tags = (
        (("regulation o", "关联贷款"), "关联贷款监管"),
        (("卫星", "satellite", "skynet"), "国防卫星"),
        (("航空", "航班", "flydubai", "劫持"), "航空安全"),
        (("黑客", "网络安全", "hack"), "网络攻防"),
        (("评估", "评测", "benchmark"), "模型评测"),
        (("交易", "trade", "chatham"), "AI交易自动化"),
        (("企业ai", "企业 ai", "autonomous ai", "智能体"), "企业智能体"),
        (("芯片", "gpu", "半导体"), "AI芯片"),
        (("开源", "open source"), "开源模型"),
        (("融资", "估值", "funding"), "科技融资"),
        (("监管", "政策", "regulation"), "行业监管"),
    )
    for keywords, derived_tag in keyword_tags:
        if any(keyword in text for keyword in keywords):
            return derived_tag
    return {
        "tech": "技术落地",
        "finance": "商业变革",
        "politics": "公共治理",
    }.get(incoming.category, "产业观察")


async def _discover_cover_image(url: str) -> Optional[str]:
    try:
        async with httpx.AsyncClient(
            timeout=7.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 NEXUS knowledge reader"},
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
        if "html" not in response.headers.get("content-type", "").lower():
            return None
        soup = BeautifulSoup(response.text[:750_000], "html.parser")
        for attrs in (
            {"property": "og:image"},
            {"name": "twitter:image"},
            {"property": "twitter:image"},
        ):
            node = soup.find("meta", attrs=attrs)
            value = node.get("content") if node else None
            if isinstance(value, str) and value.startswith("https://"):
                return value[:1000]
    except Exception:
        return None
    return None


def _verify_token(value: str) -> None:
    expected = settings.NEXUS_INGEST_TOKEN
    if not expected:
        raise HTTPException(status_code=503, detail="NEXUS 导入令牌尚未配置")
    if not hmac.compare_digest(value, expected):
        raise HTTPException(status_code=401, detail="导入令牌无效")


@router.put("/control")
async def internal_update_control(
    payload: InternalControlUpdate,
    x_nexus_ingest_token: str = Header(default=""),
):
    _verify_token(x_nexus_ingest_token)
    row = await set_delivery_enabled(payload.enabled, "local-cli")
    feishu_ok, feishu_message = await PushService().send_feishu_control_card(payload.enabled)
    return {
        "enabled": bool(row.enabled),
        "status": "running" if row.enabled else "paused",
        "message": "自动生成与推送已开启" if row.enabled else "自动生成、NEXUS 导入与飞书推送均已暂停",
        "feishu": "success" if feishu_ok else "failed",
        "feishu_message": feishu_message,
    }


@router.post("/digest")
async def import_digest(
    payload: DigestImport,
    x_nexus_ingest_token: str = Header(default=""),
):
    """Idempotently import locally generated cards, then push the new batch to Feishu."""
    _verify_token(x_nexus_ingest_token)
    control = await get_delivery_control()
    if not control.enabled:
        return {
            "status": "paused",
            "created": 0,
            "updated": 0,
            "feishu": "skipped",
            "message": "全局截停开关已关闭；历史记录保留，本次没有写入或推送。",
        }
    try:
        published_at = datetime.fromisoformat(payload.date)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="date 必须是 YYYY-MM-DD") from error

    discovered_images = await asyncio.gather(*[
        _discover_cover_image(item.source_url) if not item.cover_image else asyncio.sleep(0, result=item.cover_image)
        for item in payload.cards
    ])
    image_by_story = {
        item.story_id: image for item, image in zip(payload.cards, discovered_images) if image
    }

    created: List[NewsCard] = []
    updated = 0
    async with async_session() as db:
        for incoming in payload.cards:
            existing = (
                await db.execute(select(NewsCard).where(NewsCard.source_id == incoming.story_id))
            ).scalars().first()
            tags = [_single_topic_tag(incoming)]
            values = {
                "title": incoming.title,
                "summary": incoming.summary,
                "key_facts": incoming.key_facts[:4],
                "background": incoming.background,
                "why_it_matters": incoming.why_it_matters,
                "career_lens": incoming.career_lens,
                "glossary": incoming.glossary[:3],
                "analysis_sections": incoming.analysis_sections[:8],
                "timeline": incoming.timeline[:8],
                "stakeholders": incoming.stakeholders[:8],
                "visual_direction": incoming.visual_direction,
                "category": CATEGORY_MAP.get(incoming.category, incoming.category),
                "source": incoming.source,
                "source_url": incoming.source_url,
                "source_id": incoming.story_id,
                "heat_score": incoming.heat_score,
                "ai_value_score": incoming.ai_value_score,
                "interest_tags": tags,
                "published_at": published_at,
            }
            discovered_image = incoming.cover_image or image_by_story.get(incoming.story_id)
            if discovered_image:
                values["cover_image"] = discovered_image
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
