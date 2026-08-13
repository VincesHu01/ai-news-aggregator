import asyncio
import sys
import secrets
from datetime import datetime, timedelta

sys.path.insert(0, ".")

from app.database import async_session, init_db
from app.models.predictions import Prediction, PredictionStatus, PredictionType


PREDICTIONS = [
    {
        "question": "GPT-6 是否会在 2026 年内正式发布？",
        "category": "AI 产品",
        "expires_days": 120,
        "description": "OpenAI 是否会在 2026 年 12 月 31 日前正式发布 GPT-6 通用大模型（公开或 API 形态），并具备多模态原生能力。",
    },
    {
        "question": "2026 年底之前，AI 是否在 LeetCode Hard 上的平均通过率超过 80%？",
        "category": "代码能力",
        "expires_days": 140,
        "description": "以公开的 SWE-bench 或主流代码评测基准为准，任一 AI 模型在 LeetCode Hard 级别问题上平均通过率达到或超过 80%。",
    },
    {
        "question": "英伟达 H200 级别的下一代 GPU (H30/B30) 在 2026 年发货量是否翻倍？",
        "category": "硬件",
        "expires_days": 180,
        "description": "参考摩根士丹利/TrendForce 等机构季度报告，与 2025 年 H20 全球发货量相比，H30/B30 年发货量增长 ≥100% 记为 YES。",
    },
    {
        "question": "2026 年是否会出现真正具备 Agentic 工作流的消费级生产力爆款产品（MAU>500万）？",
        "category": "AI 应用",
        "expires_days": 150,
        "description": "定义为：可自主完成多步规划/工具调用/网页浏览，且月活跃用户 ≥500 万的消费级 AI Agent 产品。",
    },
    {
        "question": "AGI（通用人工智能）是否会在 2030 年 1 月 1 日前被广泛认可已实现？",
        "category": "AGI",
        "expires_date": "2029-12-31",
        "description": "当主流 AI 研究机构（如 OpenAI/DeepMind/Anthropic）或权威学术会议宣称已实现 AGI，或在公开可验证基准上综合表现达到人类专家水平。",
    },
    {
        "question": "中国国产大模型 2026 年底前，是否有模型能稳定超过 GPT-4o 综合水平？",
        "category": "国产模型",
        "expires_days": 140,
        "description": "在 MMLU、HumanEval、MMMU、GSM8K 四大主流基准的综合加权（取 GPT-4o 为 100）≥ 105 为 YES。",
    },
    {
        "question": "苹果是否会在 2027 年前发布自带本地 AI 能力的 Vision 产品迭代？",
        "category": "消费电子",
        "expires_days": 365,
        "description": "Apple 发布运行在本地 NPU 上、无需云端即具备多模态推理能力的 Vision Pro 或同类后续产品。",
    },
    {
        "question": "（已验证）GPT-4o 系列已于 2025 年发布",
        "category": "AI 产品",
        "settled": True,
        "result": "yes",
        "expires_days": -30,
        "description": "历史结算问题，用于展示已结算界面。2025 年 GPT-4o 系列如期发布，结果 YES。",
    },
    {
        "question": "（已验证）2025 年 AI 芯片市场同比增长 > 50%",
        "category": "硬件",
        "settled": True,
        "result": "yes",
        "expires_days": -45,
        "description": "历史结算问题，据 IDC 报告 2025 年全球 AI 加速器芯片市场同比增长率达 78%，结果 YES。",
    },
]


async def seed():
    await init_db()
    print("Seeding predictions...")
    from sqlalchemy import select

    async with async_session() as session:
        r = await session.execute(select(Prediction))
        existing = list(r.scalars().all())
        if len(existing) >= 5:
            print(f"Already have {len(existing)} predictions, skipping seed")
            return

        now = datetime.utcnow()
        for p in PREDICTIONS:
            if p.get("settled"):
                status = PredictionStatus.SETTLED.value
                result = p.get("result", "yes")
                expires = now + timedelta(days=p["expires_days"])
                settled_at = now
            else:
                status = PredictionStatus.PENDING.value
                result = None
                if p.get("expires_date"):
                    expires = datetime.fromisoformat(p["expires_date"])
                else:
                    expires = now + timedelta(days=p["expires_days"])
                settled_at = None

            pred = Prediction(
                id=secrets.token_hex(16),
                question=p["question"],
                category=p["category"],
                prediction_type=PredictionType.YES_NO.value,
                options=["yes", "no"],
                status=status,
                result=result,
                expires_at=expires,
                settled_at=settled_at,
                settlement_logic=p.get("description", ""),
                llm_source_card_ids=[],
                created_at=now,
            )
            session.add(pred)
            tag = "[SETTLED] " if status == "settled" else ""
            print(f"  + {tag}{p['question'][:40]}... ({p['category']})")

        await session.commit()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(seed())
