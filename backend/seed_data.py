import asyncio
from datetime import datetime, timedelta
from app.database import async_session
from app.models.news import NewsCard
from app.models.user import User
from app.models.rewards import CardCollection, Checkin, PointTransaction
from app.models.predictions import Prediction, PredictionBet
from app.config import settings


async def seed_data():
    async with async_session() as db:
        from sqlalchemy import select, func

        count = await db.scalar(select(func.count(NewsCard.id)))
        if count and count > 0:
            print(f"Database already has {count} cards, skipping seed")
            return

        mock_cards = [
            {
                "title": "GPT-5 革命性突破：多模态能力大幅提升",
                "summary": "最新发布的GPT-5模型在多项基准测试中刷新纪录，多模态理解能力大幅提升，能够同时处理文本、图像、音频和视频，展现出接近人类水平的推理能力。",
                "category": "AI研究",
                "source": "TechCrunch",
                "source_url": "https://techcrunch.com/example1",
                "source_id": "seed_gpt5_001",
                "heat_score": 98.5,
                "ai_value_score": 95.0,
                "interest_tags": ["GPT", "LLM", "多模态", "大模型"],
                "cover_image": None,
                "published_at": datetime.utcnow() - timedelta(hours=2),
            },
            {
                "title": "AI芯片大战：英伟达H200引领市场",
                "summary": "英伟达最新发布的H200芯片在AI训练性能上较上一代提升90%，进一步巩固了其在AI基础设施领域的主导地位。AMD和英特尔也在加紧推出新品。",
                "category": "AI产业",
                "source": "The Verge",
                "source_url": "https://theverge.com/example2",
                "source_id": "seed_nvidia_002",
                "heat_score": 95.0,
                "ai_value_score": 88.0,
                "interest_tags": ["芯片", "英伟达", "GPU", "硬件"],
                "cover_image": None,
                "published_at": datetime.utcnow() - timedelta(hours=4),
            },
            {
                "title": "斯坦福发布AI安全评估框架",
                "summary": "斯坦福大学AI实验室发布了一套全新的AI安全评估框架，涵盖了从模型对齐到部署后监控的完整流程，已被多家头部AI公司采纳为标准。",
                "category": "AI研究",
                "source": "Stanford AI Lab",
                "source_url": "https://ai.stanford.edu/example3",
                "source_id": "seed_stanford_003",
                "heat_score": 87.0,
                "ai_value_score": 92.0,
                "interest_tags": ["AI安全", "对齐", "研究", "斯坦福"],
                "cover_image": None,
                "published_at": datetime.utcnow() - timedelta(hours=6),
            },
            {
                "title": "爆款AI Agent：自主完成复杂工作流",
                "summary": "新一代AI Agent能够自主规划、执行并完成复杂的多步骤工作流，从市场分析到产品设计，展现出令人惊叹的通用能力。多家公司已集成到核心业务流程中。",
                "category": "AI应用",
                "source": "Wired",
                "source_url": "https://wired.com/example4",
                "source_id": "seed_agent_004",
                "heat_score": 99.0,
                "ai_value_score": 90.0,
                "interest_tags": ["Agent", "自动化", "工作流", "AI应用"],
                "cover_image": None,
                "published_at": datetime.utcnow() - timedelta(hours=8),
            },
            {
                "title": "美联储主席：AI将重塑金融服务业",
                "summary": "美联储主席在最新讲话中表示，人工智能将在未来十年深刻改变金融服务业，从风控到客户服务都将被AI重塑。同时强调了监管的重要性。",
                "category": "AI产业",
                "source": "Bloomberg",
                "source_url": "https://bloomberg.com/example5",
                "source_id": "seed_fed_005",
                "heat_score": 92.0,
                "ai_value_score": 85.0,
                "interest_tags": ["美联储", "金融", "监管", "AI产业"],
                "cover_image": None,
                "published_at": datetime.utcnow() - timedelta(hours=10),
            },
            {
                "title": "arXiv热点：新型Transformer架构刷新SOTA",
                "summary": "最新arXiv论文提出了一种新型Transformer架构，在保持模型规模不变的情况下，将多项NLP任务的性能提升了5-8%，训练效率提升显著。",
                "category": "AI研究",
                "source": "arXiv",
                "source_url": "https://arxiv.org/example6",
                "source_id": "seed_arxiv_006",
                "heat_score": 85.0,
                "ai_value_score": 89.0,
                "interest_tags": ["Transformer", "论文", "NLP", "arXiv"],
                "cover_image": None,
                "published_at": datetime.utcnow() - timedelta(hours=12),
            },
            {
                "title": "Anthropic发布Claude 3.5：推理能力大幅增强",
                "summary": "Anthropic发布Claude 3.5系列模型，在数学推理、代码生成和长文本理解方面均有显著提升，同时保持了Claude系列一贯的安全性和可靠性。",
                "category": "AI研究",
                "source": "Anthropic",
                "source_url": "https://anthropic.com/example7",
                "source_id": "seed_claude_007",
                "heat_score": 94.0,
                "ai_value_score": 91.0,
                "interest_tags": ["Claude", "Anthropic", "LLM", "推理"],
                "cover_image": None,
                "published_at": datetime.utcnow() - timedelta(hours=14),
            },
            {
                "title": "AI初创企业融资周报：三家公司获超亿美元",
                "summary": "本周AI领域融资热度不减，三家AI初创企业合计获得超过1亿美元融资，涵盖AI编程助手、AI医疗影像和AI芯片设计等方向。",
                "category": "AI产业",
                "source": "TechCrunch",
                "source_url": "https://techcrunch.com/example8",
                "source_id": "seed_funding_008",
                "heat_score": 80.0,
                "ai_value_score": 75.0,
                "interest_tags": ["融资", "初创企业", "投资", "AI产业"],
                "cover_image": None,
                "published_at": datetime.utcnow() - timedelta(hours=16),
            },
        ]

        for card_data in mock_cards:
            card = NewsCard(**card_data)
            db.add(card)

        await db.commit()
        print(f"Seeded {len(mock_cards)} mock cards")


if __name__ == "__main__":
    asyncio.run(seed_data())
