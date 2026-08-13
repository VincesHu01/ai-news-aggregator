from contextlib import asynccontextmanager
import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import init_db, async_session
from app.models.news import NewsCard
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


@app.post("/api/admin/seed-data")
async def seed_data():
    cards_data = []
    try:
        from app.seed_data import SEED_DATA
        cards_data = SEED_DATA
    except ImportError as e:
        return {"status": "error", "message": f"Cannot import seed data: {str(e)[:200]}"}
    
    if not cards_data:
        return {"status": "error", "message": "No seed data available"}
    
    saved = 0
    errors = []
    async with async_session() as db:
        for item in cards_data:
            try:
                source_id = item.get("source_id", "")
                if source_id:
                    existing = await db.execute(
                        select(NewsCard).where(NewsCard.source_id == source_id)
                    )
                    if existing.scalar_one_or_none():
                        continue
                
                card = NewsCard(
                    title=(item.get("title") or "Untitled")[:500],
                    summary=item.get("summary"),
                    category=item.get("category", "其他"),
                    source=item.get("source", "Unknown"),
                    source_url=(item.get("source_url") or "")[:1000],
                    source_id=source_id,
                    heat_score=float(item.get("heat_score", 0.0)),
                    ai_value_score=float(item.get("ai_value_score", 50.0)),
                    interest_tags=item.get("interest_tags") or [],
                    cover_image=item.get("cover_image"),
                )
                db.add(card)
                saved += 1
            except Exception as e:
                errors.append(f"{str(item.get('title','?'))[:30]}: {str(e)[:100]}")
        
        await db.commit()
    
    return {
        "status": "ok",
        "message": f"Seeded {saved} cards",
        "total_in_file": len(cards_data),
        "errors": errors[:5] if errors else None
    }


@app.post("/api/admin/settle-predictions")
async def trigger_settlement():
    from app.services.prediction_engine import PredictionEngine
    engine = PredictionEngine()
    try:
        await engine.settle_predictions()
        return {"status": "ok", "message": "Settlement completed"}
    except Exception as e:
        return {"status": "error", "message": str(e)[:200]}