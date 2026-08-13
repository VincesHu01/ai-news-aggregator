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
    """嵌入从RSS采集+LLM处理的真实数据"""
    test_data = [
        {
            "title": "How kids feel about AI, in their own words",
            "summary": "多数青少年已将AI用于学习娱乐，虽担忧其社会影响与创造力衰退，但希望保持控制权，主张引导而非禁止。",
            "category": "其他",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/13/1141410/how-kids-feel-about-ai-own-words/",
            "source_id": "rss_MIT_TR_1141410",
            "heat_score": 47.7,
            "ai_value_score": 55.0,
            "interest_tags": ["儿童视角", "AI态度", "AI担忧", "AI伦理"],
            "cover_image": "https://wp.technologyreview.com/wp-content/uploads/2026/08/AI_teens_coder_stasik.jpg",
        },
        {
            "title": "Scientists just created female clones of male mice",
            "summary": "日本科学家首次用CRISPR技术敲除雄鼠Y染色体，成功培育出雌性克隆小鼠，有望拯救濒危物种。",
            "category": "其他",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/12/1141768/scientists-just-created-female-clones-of-male-mice/",
            "source_id": "rss_MIT_TR_1141768",
            "heat_score": 65.52,
            "ai_value_score": 88.0,
            "interest_tags": ["CRISPR", "克隆", "Y染色体", "生殖技术", "濒危物种"],
            "cover_image": "https://wp.technologyreview.com/wp-content/uploads/2026/08/Cloned-mice.jpg",
        },
        {
            "title": "Scaling AI agents with trustworthy data",
            "summary": "报告指出，遗留数据系统制约AI智能体发展；数据领导者凭可靠数据基础，提升决策信任度并实现规模化。",
            "category": "AI产业",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/12/1141032/scaling-ai-agents-with-trustworthy-data/",
            "source_id": "rss_MIT_TR_1141032",
            "heat_score": 42.3,
            "ai_value_score": 45.0,
            "interest_tags": ["Agentic AI", "AI Agents", "Enterprise Data", "Data Infrastructure"],
            "cover_image": "https://wp.technologyreview.com/wp-content/uploads/2026/08/Google-Report-2026-cover.png",
        },
        {
            "title": "The Download: our 35 young innovators and the censorship-industrial complex",
            "summary": "麻省理工公布35岁以下创新者，探讨审查工业复合体，并报道蒙大拿州实验医疗新政。",
            "category": "其他",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/12/1141714/the-download-innovators-under-35-censorship-industrial-complex/",
            "source_id": "rss_MIT_TR_1141714",
            "heat_score": 50.4,
            "ai_value_score": 60.0,
            "interest_tags": ["青年创新者", "科技评选", "审查产业", "科技简报"],
            "cover_image": "https://wp.technologyreview.com/wp-content/uploads/2025/06/opener_thumb.jpg",
        },
        {
            "title": "How we picked 35 of the world's top young scientists and engineers",
            "summary": "麻省理工科技评论9月8日将揭晓2026年35岁以下科技创新者榜单，表彰全球顶尖青年科学家与工程师。",
            "category": "AI人物",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/12/1141605/2026-innovators-under-35-top-young-scientists-engineers/",
            "source_id": "rss_MIT_TR_1141605",
            "heat_score": 42.3,
            "ai_value_score": 45.0,
            "interest_tags": ["青年科学家", "科技创新", "前沿技术", "TR35榜单"],
            "cover_image": None,
        },
        {
            "title": "How the censorship-industrial complex is changing the internet and US policy",
            "summary": "审查工业复合体指控致美相关机构关闭，该叙事成特朗普政府政策逻辑，并重塑全球互联网生态。",
            "category": "其他",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/11/1141635/how-the-censorship-industrial-complex-is-changing-the-internet-and-us-policy/",
            "source_id": "rss_MIT_TR_1141635",
            "heat_score": 62.28,
            "ai_value_score": 82.0,
            "interest_tags": ["审查制度", "虚假信息", "美国政策", "科技巨头"],
            "cover_image": None,
        },
        {
            "title": "The Download: the next big thing in LLMs and how AI academic research is shifting",
            "summary": "初创公司探索新架构突破大模型瓶颈，AI学术研究面临新现实，英伟达获巨额基建投资。",
            "category": "AI研究",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/11/1141610/the-download-next-big-thing-llms-ai-academic-research-shifting/",
            "source_id": "rss_MIT_TR_1141610",
            "heat_score": 63.9,
            "ai_value_score": 85.0,
            "interest_tags": ["LLMs", "Transformer", "AI研究", "模型优化"],
            "cover_image": "https://wp.technologyreview.com/wp-content/uploads/2025/10/MIT_FeatureSelection_Full_1.jpg",
        },
        {
            "title": "AI professors are negotiating the new realities of academic research",
            "summary": "AI前沿转向私企，学术界因算力与资金受限，正调整研究方向，聚焦企业不愿涉足的非盈利领域。",
            "category": "AI研究",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/10/1141597/ai-professors-are-negotiating-the-new-realities-of-academic-research/",
            "source_id": "rss_MIT_TR_1141597",
            "heat_score": 39.6,
            "ai_value_score": 40.0,
            "interest_tags": ["AI研究", "学术研究", "大模型", "AI教授"],
            "cover_image": None,
        },
        {
            "title": "AI agents for science, and the censorship-industrial complex",
            "summary": "Download: AI agents for science, and the censorship-industrial complex",
            "category": "AI应用",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/10/1141526/the-download-ai-agents-science-censorship-industrial-complex/",
            "source_id": "rss_MIT_TR_1141526",
            "heat_score": 61.2,
            "ai_value_score": 80.0,
            "interest_tags": ["AI智能体", "AI科研", "AlphaFold", "科学发现"],
            "cover_image": "https://wp.technologyreview.com/wp-content/uploads/2025/10/ND25-opensource-169.jpg",
        },
        {
            "title": "AI for science needs reasoning, not just data",
            "summary": "AI加速科学不能仅靠数据，更需依赖具备推理能力的智能体，而非复制阿尔法折叠的数据模式。",
            "category": "AI应用",
            "source": "RSS",
            "source_url": "https://www.technologyreview.com/2026/08/10/1141384/ai-agents-for-science/",
            "source_id": "rss_MIT_TR_1141384",
            "heat_score": 60.12,
            "ai_value_score": 78.0,
            "interest_tags": ["AI科研", "AlphaFold", "科学推理", "蛋白结构"],
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