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
    """直接嵌入少量真实数据作为种子"""
    test_data = [
        {
            "title": "AI Breakthrough: New Model Outperforms Humans on Math",
            "summary": "研究人员开发的新AI模型在数学推理测试中首次超越人类专家水平，标志着AI在逻辑推理领域的重大突破。",
            "category": "AI技术",
            "source": "seed",
            "source_url": "https://example.com/ai-breakthrough",
            "source_id": "seed_001",
            "heat_score": 95.0,
            "ai_value_score": 92.0,
            "interest_tags": ["AI突破", "数学推理", "大模型", "技术前沿"],
            "cover_image": None,
        },
        {
            "title": "全球AI治理框架达成重要共识",
            "summary": "多国代表就全球AI治理框架达成初步共识，旨在平衡AI创新与安全风险，推动负责任的AI发展。",
            "category": "AI政策",
            "source": "seed",
            "source_url": "https://example.com/ai-governance",
            "source_id": "seed_002",
            "heat_score": 88.0,
            "ai_value_score": 85.0,
            "interest_tags": ["AI治理", "AI政策", "全球合作", "伦理"],
            "cover_image": None,
        },
        {
            "title": "量子计算首次实现百万量子比特运算",
            "summary": "科技公司宣布其量子计算机首次实现百万量子比特级别的稳定运算，为药物研发和材料科学带来革命性影响。",
            "category": "AI技术",
            "source": "seed",
            "source_url": "https://example.com/quantum-computing",
            "source_id": "seed_003",
            "heat_score": 93.0,
            "ai_value_score": 90.0,
            "interest_tags": ["量子计算", "量子比特", "计算革命", "科研进展"],
            "cover_image": None,
        },
    ]
    
    saved = 0
    async with async_session() as db:
        for item in test_data:
            try:
                card = NewsCard(
                    title=item["title"],
                    summary=item["summary"],
                    category=item["category"],
                    source=item["source"],
                    source_url=item["source_url"],
                    source_id=item["source_id"],
                    heat_score=item["heat_score"],
                    ai_value_score=item["ai_value_score"],
                    interest_tags=item["interest_tags"],
                    cover_image=item.get("cover_image"),
                )
                db.add(card)
                saved += 1
            except Exception as e:
                logger.error(f"Seed error for {item['title'][:30]}: {e}")
        await db.commit()
    
    return {"status": "ok", "message": f"Seeded {saved} cards"}


@app.post("/api/admin/settle-predictions")
async def trigger_settlement():
    from app.services.prediction_engine import PredictionEngine
    engine = PredictionEngine()
    try:
        await engine.settle_predictions()
        return {"status": "ok", "message": "Settlement completed"}
    except Exception as e:
        return {"status": "error", "message": str(e)[:200]}