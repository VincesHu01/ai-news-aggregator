from contextlib import asynccontextmanager
import asyncio
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import init_db, async_session, get_db
from app.models.news import NewsCard
from app.models.predictions import PredictionBet
from app.models.push import PushHistory, UserPushSettings
from app.models.user import User
from app.routers import auth, news, rewards, predictions, shares, friends
from app.utils.security import get_current_user

logger = logging.getLogger(__name__)

# 全局 collector 单例：避免每次调用都 new 一个，从而"去抖"的 _last_collection_finished_at 生效
_COLLECTOR_SINGLETON: Optional["DataCollector"] = None


def get_collector() -> "DataCollector":
    global _COLLECTOR_SINGLETON
    if _COLLECTOR_SINGLETON is None:
        from app.services.collector import DataCollector
        _COLLECTOR_SINGLETON = DataCollector()
    return _COLLECTOR_SINGLETON


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    collector = get_collector()
    await collector.start_scheduler(interval_hours=settings.COLLECTION_INTERVAL_HOURS)
    # 启动时不重复跑：如果用户一打开就触发，lifespan 里不再跑，避免立刻两次采集。
    logger.info(f"数据采集器调度器已启动（模式：{'00:00 cron' if settings.COLLECTION_INTERVAL_HOURS == 24 else f'interval {settings.COLLECTION_INTERVAL_HOURS}h'}）")
    yield
    await collector.stop_scheduler()


app = FastAPI(
    title="AI News Aggregator API",
    description="AI驱动的新闻聚合与预测平台",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(news.router, prefix="/api/news", tags=["News"])
app.include_router(rewards.router, prefix="/api/rewards", tags=["Rewards"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(shares.router, prefix="/api/shares", tags=["Shares"])
app.include_router(friends.router, prefix="/api/friends", tags=["Friends"])


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "service": "AI News Aggregator",
    }


@app.get("/api/public/stats")
async def public_stats():
    async with async_session() as db:
        news_count = await db.scalar(select(func.count()).select_from(NewsCard))
        users_count = await db.scalar(select(func.count()).select_from(User))
        bets_count = await db.scalar(select(func.count()).select_from(PredictionBet))
    return {
        "news_count": int(news_count or 0),
        "users_count": int(users_count or 0),
        "bets_count": int(bets_count or 0),
    }


# ==============================================================================
# 触发采集 + 推送（匿名可访问，用户打开首页就调一次，带 MIN 间隔去抖防刷）
# ==============================================================================
@app.post("/api/public/trigger-collection")
async def public_trigger_collection():
    """匿名访问触发采集 + 推送。
    - 20 分钟内跑过直接返回 skipped（ok=false, reason=...），不花一分钱。
    - 采集 + LLM + 推送都后台 asyncio 跑，HTTP 立刻返回状态。
    """
    collector = get_collector()

    async def _bg():
        try:
            await collector.trigger_collection(trigger_type="auto_visit", force=False)
        except Exception as e:
            logger.error(f"[auto_visit] 后台采集任务异常: {str(e)[:200]}")

    # 先用同步方式判断一次是否需要跳过（避免连续 N 个用户开页面都 create_task 堆积）
    precheck = await collector.trigger_collection(trigger_type="auto_visit", force=False)
    # 如果实际已触发（ok=true），上面已经跑过了；如果 ok=false 是在"20 分钟内已跑过"，直接返回即可。
    return {"status": "ok" if precheck["ok"] else "skipped", "detail": precheck}


# ==============================================================================
# 历史推送（任何人登录后都可查自己"能看"的推送；这里推送对登录用户都可见，因为就是本站新闻）
# ==============================================================================
class PushHistoryItem(BaseModel):
    id: str
    trigger_type: str
    push_channel: str
    status: str
    news_count: int
    recipient_count: int
    success_count: int
    failed_count: int
    title: Optional[str] = None
    summary: Optional[str] = None
    news_card_ids: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None
    created_at: datetime
    sent_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@app.get("/api/push-history", response_model=List[PushHistoryItem])
async def list_push_history(
    page: int = 1,
    page_size: int = 20,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """历史推送页：按 created_at 倒序"""
    page = max(1, page)
    page_size = min(50, max(1, page_size))
    stmt = (
        select(PushHistory)
        .order_by(desc(PushHistory.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


@app.get("/api/push-history/{history_id}", response_model=PushHistoryItem)
async def get_push_history_detail(
    history_id: str,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    h = await db.get(PushHistory, history_id)
    if not h:
        raise HTTPException(status_code=404, detail="推送记录不存在")
    return h


# ==============================================================================
# 用户推送设置
# ==============================================================================
class UserPushSettingsUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    email_override: Optional[str] = None
    wechat_enabled: Optional[bool] = None
    push_on_visit: Optional[bool] = None
    push_on_daily_cron: Optional[bool] = None
    interest_tags_filter: Optional[List[str]] = None
    min_ai_value_score: Optional[int] = None


class UserPushSettingsResponse(BaseModel):
    id: Optional[str] = None
    email_enabled: bool = False
    email_override: Optional[str] = None
    email_verified: bool = False
    wechat_enabled: bool = False
    wechat_userid: Optional[str] = None
    push_on_visit: bool = False
    push_on_daily_cron: bool = True
    interest_tags_filter: List[str] = Field(default_factory=list)
    min_ai_value_score: int = 0
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


def _default_settings(user_id: str) -> UserPushSettingsResponse:
    return UserPushSettingsResponse(
        push_on_daily_cron=True,
        interest_tags_filter=[],
    )


@app.get("/api/user/push-settings", response_model=UserPushSettingsResponse)
async def get_push_settings(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(UserPushSettings).where(UserPushSettings.user_id == user.id))).scalar_one_or_none()
    if not s:
        return _default_settings(user.id)
    return UserPushSettingsResponse.model_validate(s)


@app.put("/api/user/push-settings", response_model=UserPushSettingsResponse)
async def update_push_settings(
    payload: UserPushSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = (await db.execute(select(UserPushSettings).where(UserPushSettings.user_id == user.id))).scalar_one_or_none()
    if not s:
        s = UserPushSettings(user_id=user.id)
        db.add(s)
        await db.flush()

    if payload.email_enabled is not None:
        s.email_enabled = payload.email_enabled
    if payload.email_override is not None:
        candidate = (payload.email_override or "").strip().lower()
        s.email_override = candidate or None
        if candidate:
            # 邮箱校验
            import re
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", candidate):
                raise HTTPException(status_code=400, detail="订阅邮箱格式不正确")
            # 如果修改了邮箱，重置 verified 为 False，下次发送成功时才算"验证过"
            s.email_verified = False
    if payload.wechat_enabled is not None:
        s.wechat_enabled = payload.wechat_enabled
        # 打开微信推送时，若没有 userid，保留为 True 但发送时会跳过 + 提示用户扫码绑定
    if payload.push_on_visit is not None:
        s.push_on_visit = payload.push_on_visit
    if payload.push_on_daily_cron is not None:
        s.push_on_daily_cron = payload.push_on_daily_cron
    if payload.interest_tags_filter is not None:
        s.interest_tags_filter = list(payload.interest_tags_filter or [])
    if payload.min_ai_value_score is not None:
        s.min_ai_value_score = max(0, min(100, int(payload.min_ai_value_score)))

    await db.commit()
    await db.refresh(s)
    return UserPushSettingsResponse.model_validate(s)


# ==============================================================================
# 测试推送接口（登录用户可以给自己发一封测试邮件，用来验证邮箱连通性）
# ==============================================================================
@app.post("/api/user/push-settings/send-test-email")
async def send_test_email(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.push_service import PushService
    s = (await db.execute(select(UserPushSettings).where(UserPushSettings.user_id == user.id))).scalar_one_or_none()
    target_email = (s.email_override if s else None) or user.email or ""
    if not target_email or "@" not in target_email:
        raise HTTPException(status_code=400, detail="未设置可用于发送的邮箱，请先在「推送设置」中填写邮箱")

    svc = PushService()
    ok, fails = svc._send_emails_sync(
        [{
            "email": target_email,
            "nickname": user.nickname or target_email.split("@")[0],
            "tags_filter": [],
            "min_score": 0,
        }],
        cards=[],
        title="[NEXUS AI] 这是一封推送连通性测试邮件",
        body=(
            f"Hi，{(user.nickname or target_email.split('@')[0])}：\n\n"
            "如果你能收到这封邮件，说明 NEXUS AI 的邮件推送配置（SMTP）是 OK 的。\n"
            "回到网站继续开启「每日 00:00 定时推送」或「访问触发推送」即可。\n\n"
            "https://ai-news-frontend-kappa.vercel.app/profile\n"
        ),
    )
    if ok:
        # 发成功则把该用户邮箱标记为 verified
        if s is None:
            s = UserPushSettings(user_id=user.id, email_verified=True)
            db.add(s)
        else:
            s.email_verified = True
        await db.commit()
        return {"status": "ok", "message": f"已发送到 {target_email}，请查收（可能在垃圾箱）。"}
    if not settings.MAIL_SERVER or not settings.MAIL_USERNAME:
        raise HTTPException(
            status_code=400,
            detail=(
                "未检测到邮件 SMTP 配置（MAIL_SERVER/MAIL_USERNAME 为空）。"
                "请在 Render 的 Environment Variables 或本地 .env 里配置 MAIL_SERVER / MAIL_PORT / "
                "MAIL_USERNAME / MAIL_PASSWORD / MAIL_USE_TLS / MAIL_FROM。"
                "推荐使用 Gmail 应用密码、腾讯企业邮、SendGrid、Resend 等。"
            ),
        )
    raise HTTPException(status_code=500, detail="测试邮件发送失败，请检查 SMTP 配置或稍后重试。")


# ==============================================================================
# Admin：手动触发一次采集+推送（force=True，跳过 20min 间隔）
# ==============================================================================
@app.post("/api/admin/run-collection")
async def trigger_collection_admin():
    collector = get_collector()

    async def _bg():
        try:
            await collector.trigger_collection(trigger_type="manual", force=True)
        except Exception as e:
            logger.error(f"[admin manual] 后台采集任务异常: {str(e)[:200]}")

    asyncio.create_task(_bg())
    return {"status": "ok", "message": "后台已触发一次采集+推送（force），查看日志或 /api/push-history 获取结果"}


@app.get("/api/admin/db-check")
async def db_check():
    try:
        async with async_session() as db:
            result = await db.execute(select(NewsCard).limit(1))
            count = result.scalars().all()
            return {"status": "ok", "connection": "working", "sample_count": len(count)}
    except Exception as e:
        return {"status": "error", "message": str(e)[:500]}


@app.post("/api/admin/settle-predictions")
async def trigger_settlement():
    from app.services.prediction_engine import PredictionEngine
    engine = PredictionEngine()
    try:
        await engine.settle_predictions()
        return {"status": "ok", "message": "Settlement completed"}
    except Exception as e:
        return {"status": "error", "message": str(e)[:200]}