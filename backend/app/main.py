from contextlib import asynccontextmanager
import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func

from app.config import settings
from app.database import init_db, async_session
from app.models.news import NewsCard
from app.models.user import User
from app.models.predictions import PredictionBet
from app.routers import auth, news, rewards, predictions, shares

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    from app.services.collector import DataCollector
    collector = DataCollector()
    await collector.start_scheduler(interval_hours=settings.COLLECTION_INTERVAL_HOURS)
    # 启动时自动触发一次采集
    asyncio.create_task(collector.run_collection())
    logger.info("数据采集器调度器已启动，首次采集已触发")
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


@app.post("/api/admin/run-collection")
async def trigger_collection():
    from app.services.collector import DataCollector
    collector = DataCollector()
    try:
        asyncio.create_task(collector.run_collection())
        return {"status": "ok", "message": "Collection started in background"}
    except Exception as e:
        return {"status": "error", "message": str(e)[:200]}


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