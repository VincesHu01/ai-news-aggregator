from datetime import datetime, date
import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.database import get_db
from app.models.user import User
from app.models.news import ReadingRecord
from app.models.rewards import CardCollection, Checkin, PointTransaction, TransactionType, CardRarity
from app.schemas.rewards import (
    CardCollectionResponse,
    CheckinResponse,
    PointBalanceResponse,
    LeaderboardEntry,
    DrawCardResponse,
)
from app.utils.security import get_current_user
from app.utils.helpers import calculate_streak, generate_invite_code
from app.services.rewards_engine import RewardsEngine

router = APIRouter()


# ==============================================================================
# 卡牌内容池（类似哈利波特巧克力蛙卡牌）
# ==============================================================================
CARD_POOL = [
    # --- 人物 figure ---
    {
        "card_type": "figure",
        "name": "Geoffrey Hinton",
        "series": "AI 先驱",
        "description": "深度学习之父，2024 年诺贝尔物理学奖得主。",
        "lore": "Hinton 在 1986 年与人合著了反向传播算法的奠基性论文，奠定了现代深度学习的基础。他先后在多伦多大学和 Google Brain 工作，2023 年从 Google 离职以自由发声 AI 风险。",
        "trivia_question": "Hinton 在 2024 年获得了哪个领域的诺贝尔奖？",
        "trivia_answer": "诺贝尔物理学奖（与 John Hopfield 共同获奖）",
    },
    {
        "card_type": "figure",
        "name": "Sam Altman",
        "series": "AI 领袖",
        "description": "OpenAI CEO，ChatGPT 背后的推动者。",
        "lore": "Altman 于 2015 年参与创立 OpenAI，2019 年成为 CEO。在他的领导下，OpenAI 发布了 GPT 系列模型，引发了全球生成式 AI 浪潮。2023 年经历了短暂的董事会风波后复职。",
        "trivia_question": "Sam Altman 在 2023 年 11 月经历了什么事件？",
        "trivia_answer": "被 OpenAI 董事会解雇后数日内复职",
    },
    {
        "card_type": "figure",
        "name": "Demis Hassabis",
        "series": "AI 先驱",
        "description": "DeepMind 创始人，AlphaGo 缔造者。",
        "lore": "Hassabis 是国际象棋神童和游戏设计师，2010 年创立 DeepMind。他领导的团队开发了 AlphaGo、AlphaFold 和 AlphaStar，在围棋、蛋白质折叠和星际争霸等领域实现了里程碑式突破。",
        "trivia_question": "AlphaGo 在 2016 年击败了哪位围棋世界冠军？",
        "trivia_answer": "李世石",
    },
    {
        "card_type": "figure",
        "name": "Fei-Fei Li",
        "series": "AI 先驱",
        "description": "ImageNet 创始人，计算机视觉先驱。",
        "lore": "李飞飞创建了 ImageNet 数据集和挑战赛，直接推动了深度学习革命。她是斯坦福大学教授，曾任 Google Cloud AI 首席科学家，致力于让 AI 更加包容和以人为本。",
        "trivia_question": "ImageNet 数据集包含多少张标注图片？",
        "trivia_answer": "超过 1400 万张",
    },
    {
        "card_type": "figure",
        "name": "Yann LeCun",
        "series": "AI 先驱",
        "description": "卷积神经网络之父，Meta 首席 AI 科学家。",
        "lore": "LeCun 在 1980 年代末发明了卷积神经网络（CNN），广泛用于图像识别。他是 NYU 教授和 Meta 首席 AI 科学家，2018 年图灵奖得主，提出了「世界模型」概念。",
        "trivia_question": "LeCun 提出的哪种网络架构成为了图像识别的基础？",
        "trivia_answer": "卷积神经网络（CNN）",
    },
    # --- 技术 tech ---
    {
        "card_type": "tech",
        "name": "Transformer",
        "series": "核心技术",
        "description": "2017 年 Google 提出的革命性神经网络架构。",
        "lore": "Transformer 架构通过自注意力机制（Self-Attention）摆脱了 RNN 的序列依赖，实现了完全并行的训练。它是 GPT、BERT、ChatGPT 等所有现代大语言模型的基石。",
        "trivia_question": "Transformer 架构发表于哪篇论文？",
        "trivia_answer": "「Attention Is All You Need」（2017）",
    },
    {
        "card_type": "tech",
        "name": "Diffusion Model",
        "series": "核心技术",
        "description": "当前主流的生成式图像模型技术。",
        "lore": "扩散模型通过逐步去噪的方式生成图像，是 Stable Diffusion、DALL-E 3 和 Midjourney 的核心技术。其灵感来源于热力学中的扩散过程。",
        "trivia_question": "扩散模型生成图像的过程是什么的逆过程？",
        "trivia_answer": "逐步加噪（前向扩散过程）",
    },
    {
        "card_type": "tech",
        "name": "RLHF",
        "series": "核心技术",
        "description": "基于人类反馈的强化学习，让 AI 对齐人类价值观。",
        "lore": "RLHF（Reinforcement Learning from Human Feedback）通过人类对模型输出的偏好标注来训练奖励模型，再用强化学习优化模型行为。这是 ChatGPT 比 GPT-3 更「好用」的关键技术。",
        "trivia_question": "RLHF 的三个阶段是什么？",
        "trivia_answer": "监督微调 → 训练奖励模型 → PPO 强化学习优化",
    },
    {
        "card_type": "tech",
        "name": "Mixture of Experts",
        "series": "核心技术",
        "description": "MoE 架构：用稀疏激活实现超大规模模型。",
        "lore": "MoE 将模型分为多个「专家」子网络，每次推理只激活其中一部分，从而在保持参数量的同时大幅降低计算成本。Mistral 8x7B 和 GPT-4 都采用了 MoE 架构。",
        "trivia_question": "MoE 在推理时的主要优势是什么？",
        "trivia_answer": "稀疏激活，大幅降低推理计算量",
    },
    # --- 公司 company ---
    {
        "card_type": "company",
        "name": "OpenAI",
        "series": "AI 巨头",
        "description": "ChatGPT 和 GPT 系列模型的创造者。",
        "lore": "OpenAI 成立于 2015 年，最初是非营利组织，后转型为「上限利润」结构。其 GPT-4 模型被认为是当前最强大的通用 AI 模型之一，ChatGPT 在 2 个月内突破 1 亿用户。",
        "trivia_question": "OpenAI 最初成立时是什么类型的组织？",
        "trivia_answer": "非营利研究实验室",
    },
    {
        "card_type": "company",
        "name": "DeepMind",
        "series": "AI 巨头",
        "description": "Google 旗下 AI 实验室，AlphaFold 和 AlphaGo 的缔造者。",
        "lore": "DeepMind 于 2010 年在伦敦成立，2014 年被 Google 收购。其 AlphaFold 解决了困扰生物学 50 年的蛋白质折叠问题，被《Nature》称为「改变一切」的突破。",
        "trivia_question": "DeepMind 的 AlphaFold 解决了什么生物学难题？",
        "trivia_answer": "蛋白质结构预测",
    },
    {
        "card_type": "company",
        "name": "Anthropic",
        "series": "AI 巨头",
        "description": "Claude 系列模型的开发商，专注 AI 安全。",
        "lore": "Anthropic 由前 OpenAI 研究员 Dario Amodei 等人于 2021 年创立，专注于 AI 安全和对齐研究。其 Claude 模型以长文本理解和宪法 AI（Constitutional AI）技术著称。",
        "trivia_question": "Anthropic 独创的 AI 对齐方法叫什么？",
        "trivia_answer": "Constitutional AI（宪法 AI）",
    },
    {
        "card_type": "company",
        "name": "NVIDIA",
        "series": "AI 巨头",
        "description": "全球最大的 AI 芯片供应商，GPU 巨头。",
        "lore": "NVIDIA 的 GPU 是训练大模型的标准硬件，其 H100 和 A100 芯片几乎垄断了 AI 训练市场。2024 年市值一度突破 3 万亿美元，成为全球最有价值的公司之一。",
        "trivia_question": "NVIDIA 的 AI 训练旗舰芯片系列叫什么？",
        "trivia_answer": "Hopper 架构 H100 / Blackwell 架构 B200",
    },
    # --- AI 伦理 ethics ---
    {
        "card_type": "ethics",
        "name": "AI 对齐问题",
        "series": "AI 伦理",
        "description": "如何确保 AI 系统的目标与人类价值观一致？",
        "lore": "AI 对齐（Alignment）是确保 AI 系统追求的目标与人类真实意图一致的研究领域。核心挑战包括：奖励规格化（Reward Hacking）、分布外泛化、可解释性、可扩展监督等。这是 AI 安全的核心议题。",
        "trivia_question": "什么是「奖励规格化」（Reward Hacking）？",
        "trivia_answer": "AI 找到符合奖励函数字面含义但违背设计者意图的捷径行为",
    },
    {
        "card_type": "ethics",
        "name": "算法偏见",
        "series": "AI 伦理",
        "description": "AI 系统可能放大和固化社会中的既有偏见。",
        "lore": "训练数据中的历史偏见会被模型学习并在预测中放大。典型案例包括面部识别对深色皮肤的较高错误率、招聘 AI 偏向男性简历、信贷评估歧视少数族裔等。解决需要数据审计、公平性约束和多样化团队。",
        "trivia_question": "为什么 AI 模型会产生偏见？",
        "trivia_answer": "训练数据中包含历史偏见，模型学习并在推理中放大",
    },
    {
        "card_type": "ethics",
        "name": "深度伪造",
        "series": "AI 伦理",
        "description": "AI 生成的逼真假视频、假音频带来的信任危机。",
        "lore": "Deepfake 技术可以生成几乎无法辨别的虚假视频和音频，被滥用于诈骗、政治操纵和网络暴力。检测技术与生成技术的「军备竞赛」持续升级，水印和溯源技术是主要应对方向。",
        "trivia_question": "目前对抗 Deepfake 的主要技术手段有哪些？",
        "trivia_answer": "数字水印、内容溯源（C2PA）、AI 检测模型、区块链存证",
    },
    # --- 里程碑事件 event ---
    {
        "card_type": "event",
        "name": "AlphaGo 战胜李世石",
        "series": "AI 里程碑",
        "description": "2016 年，AI 首次在围棋中击败世界冠军。",
        "lore": "2016 年 3 月，DeepMind 的 AlphaGo 以 4:1 击败围棋世界冠军李世石。围棋曾被认为是 AI 最难攻克的棋类游戏。这场比赛的第 37 手被棋坛评为「神之一手」，改变了人类对 AI 创造力的认知。",
        "trivia_question": "AlphaGo 在第四局中输给了李世石，这局棋被称为什么？",
        "trivia_answer": "李世石的神之一手（第 78 手）",
    },
    {
        "card_type": "event",
        "name": "ChatGPT 发布",
        "series": "AI 里程碑",
        "description": "2022 年 11 月 30 日，ChatGPT 上线，引发全球 AI 热潮。",
        "lore": "ChatGPT 上线 5 天内用户突破 100 万，2 个月达到 1 亿月活，成为史上增长最快的消费级应用。它让普通人第一次直观感受到 AI 的能力，引发了全球范围内的 AI 军备竞赛和监管讨论。",
        "trivia_question": "ChatGPT 达到 1 亿用户用了多长时间？",
        "trivia_answer": "约 2 个月（2023 年 1 月）",
    },
    {
        "card_type": "event",
        "name": "GPT-4 发布",
        "series": "AI 里程碑",
        "description": "2023 年 3 月，OpenAI 发布多模态大模型 GPT-4。",
        "lore": "GPT-4 是首个能在律师考试中击败 90% 人类考生的大模型，支持图像理解、长文本推理和代码生成。它在多项学术和职业测试中达到人类专家水平，标志着通用 AI 的重大进步。",
        "trivia_question": "GPT-4 在美国律师考试（BAR Exam）中击败了多少比例的考生？",
        "trivia_answer": "约 90%（排名前 10%）",
    },
]


def _generate_card_content(rarity: str, source_card=None) -> dict:
    """根据稀有度从卡牌池中随机选择一张并填充内容"""
    template = random.choice(CARD_POOL)
    content = {
        "card_name": template["name"],
        "card_type": template["card_type"],
        "card_series": template["series"],
        "description": template["description"],
    }
    # R 及以上才有 lore
    if rarity in ("R", "SR", "SSR"):
        content["lore"] = template.get("lore")
    # SR 及以上才有 trivia
    if rarity in ("SR", "SSR"):
        content["trivia_question"] = template.get("trivia_question")
        content["trivia_answer"] = template.get("trivia_answer")
    # SSR 额外加上一段思考引导
    if rarity == "SSR":
        content["lore"] = (
            (content.get("lore") or "")
            + "\n\n【SSR 特别篇】这张传说级卡牌代表着 AI 发展中一个不可忽视的里程碑。"
            "持有它，意味着你对 AI 的理解已经超越了大多数人的认知边界。"
        )
    # 关联源新闻
    if source_card:
        content["source_card_id"] = source_card.id
    return content


async def _get_merged_user(db: AsyncSession, current_user: User) -> User:
    merged = await db.get(User, current_user.id)
    if not merged:
        raise HTTPException(status_code=401, detail="用户不存在")
    return merged


@router.get("/balance", response_model=PointBalanceResponse)
async def get_balance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    merged_user = await _get_merged_user(db, current_user)

    checkin_count_query = select(func.count(Checkin.id)).where(Checkin.user_id == merged_user.id)
    checkins_count = await db.scalar(checkin_count_query) or 0

    cards_count_query = select(func.count(CardCollection.id)).where(CardCollection.user_id == merged_user.id)
    cards_count = await db.scalar(cards_count_query) or 0

    rewards_engine = RewardsEngine()
    next_level_exp = rewards_engine.get_next_level_experience(merged_user.level)

    return PointBalanceResponse(
        points=merged_user.points,
        experience=merged_user.experience,
        level=merged_user.level,
        intelligence=merged_user.intelligence,
        next_level_experience=next_level_exp,
        total_checkins=checkins_count,
        cards_collected=cards_count,
    )


@router.post("/checkin", response_model=CheckinResponse)
async def daily_checkin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    merged_user = await _get_merged_user(db, current_user)

    today_str = date.today().isoformat()

    existing_query = select(Checkin).where(
        Checkin.user_id == merged_user.id,
        Checkin.checkin_date == today_str,
    )
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="今日已签到")

    history_query = select(Checkin.checkin_date).where(
        Checkin.user_id == merged_user.id,
    )
    history_result = await db.execute(history_query)
    history_dates = list(history_result.scalars().all())

    streak = calculate_streak(history_dates) + 1

    rewards_engine = RewardsEngine()
    points, exp = rewards_engine.calculate_checkin_rewards(streak)

    checkin = Checkin(
        user_id=merged_user.id,
        checkin_date=today_str,
        streak_days=streak,
        earned_points=points,
        earned_experience=exp,
    )
    db.add(checkin)

    merged_user.points += points
    merged_user.experience += exp

    new_level = rewards_engine.get_level_from_experience(merged_user.experience)
    if new_level > merged_user.level:
        merged_user.level = new_level

    transaction = PointTransaction(
        user_id=merged_user.id,
        transaction_type=TransactionType.CHECKIN.value,
        amount=points,
        description=f"每日签到奖励（连续{streak}天）",
    )
    db.add(transaction)

    await db.commit()
    await db.refresh(checkin)

    return CheckinResponse.model_validate(checkin)


@router.get("/cards", response_model=list[CardCollectionResponse])
async def get_cards(
    rarity: Optional[str] = Query(None, pattern="^(SSR|SR|R|N)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    merged_user = await _get_merged_user(db, current_user)

    query = select(CardCollection).where(CardCollection.user_id == merged_user.id)
    if rarity:
        query = query.where(CardCollection.card_rarity == rarity)

    query = query.order_by(desc(CardCollection.obtained_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    cards = result.scalars().all()
    return [CardCollectionResponse.model_validate(c) for c in cards]


@router.post("/draw-card", response_model=DrawCardResponse)
async def draw_card(
    card_series: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.news import NewsCard

    merged_user = await _get_merged_user(db, current_user)

    draw_cost = 50
    if merged_user.points < draw_cost:
        raise HTTPException(status_code=400, detail="积分不足，无法抽卡")

    rewards_engine = RewardsEngine()
    rarity = rewards_engine.calculate_draw_card_rarity()

    source_query = select(NewsCard)
    source_result = await db.execute(source_query)
    all_cards = source_result.scalars().all()
    source_card = random.choice(all_cards) if all_cards else None

    card_content = _generate_card_content(rarity, source_card)

    card = CardCollection(
        user_id=merged_user.id,
        card_name=card_content["card_name"],
        card_rarity=rarity,
        card_series=card_content.get("card_series", "AI新闻精选"),
        card_image=card_content.get("card_image"),
        source_card_id=card_content.get("source_card_id"),
        card_type=card_content.get("card_type"),
        description=card_content.get("description"),
        lore=card_content.get("lore"),
        trivia_question=card_content.get("trivia_question"),
        trivia_answer=card_content.get("trivia_answer"),
        is_synthesized=False,
    )
    db.add(card)

    merged_user.points -= draw_cost

    transaction = PointTransaction(
        user_id=merged_user.id,
        transaction_type=TransactionType.DRAW_CARD.value,
        amount=-draw_cost,
        description=f"抽取{rarity}卡片",
    )
    db.add(transaction)

    await db.commit()
    await db.refresh(card)

    card_response = CardCollectionResponse.model_validate(card)

    return DrawCardResponse(
        card=card_response,
        points_remaining=merged_user.points,
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).order_by(desc(User.experience)).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    items = []
    for rank, user in enumerate(users, 1):
        items.append(
            LeaderboardEntry(
                rank=rank,
                user_id=user.id,
                nickname=user.nickname or user.email.split("@")[0],
                avatar_url=user.avatar_url,
                score=user.experience,
                level=user.level,
            )
        )

    return items


# ==============================================================================
# 每日任务
# ==============================================================================
DAILY_READ_TARGET = 5
DAILY_READ_REWARD_POINTS = 30
DAILY_READ_REWARD_EXP = 15


@router.get("/daily-tasks")
async def get_daily_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取今日任务进度"""
    merged_user = await _get_merged_user(db, current_user)
    today_str = date.today().isoformat()
    today_start = datetime.combine(date.today(), datetime.min.time())

    # 今日阅读数
    read_count_q = (
        select(func.count())
        .select_from(ReadingRecord)
        .where(
            ReadingRecord.user_id == merged_user.id,
            ReadingRecord.created_at >= today_start,
        )
    )
    read_count = await db.scalar(read_count_q) or 0

    # 今日是否签到
    checkin_q = select(Checkin).where(
        Checkin.user_id == merged_user.id,
        Checkin.checkin_date == today_str,
    )
    checked_in = (await db.execute(checkin_q)).scalar_one_or_none() is not None

    # 今日阅读任务是否已领取
    claim_q = select(PointTransaction).where(
        PointTransaction.user_id == merged_user.id,
        PointTransaction.transaction_type == TransactionType.ADMIN.value,
        PointTransaction.description == f"daily_read_task_{today_str}",
    )
    read_task_claimed = (await db.execute(claim_q)).scalar_one_or_none() is not None

    return {
        "date": today_str,
        "tasks": [
            {
                "id": "read_5",
                "title": "阅读 5 篇资讯",
                "progress": min(read_count, DAILY_READ_TARGET),
                "target": DAILY_READ_TARGET,
                "reward_points": DAILY_READ_REWARD_POINTS,
                "reward_experience": DAILY_READ_REWARD_EXP,
                "completed": read_count >= DAILY_READ_TARGET,
                "claimed": read_task_claimed,
                "claimable": read_count >= DAILY_READ_TARGET and not read_task_claimed,
            },
            {
                "id": "checkin",
                "title": "每日签到",
                "progress": 1 if checked_in else 0,
                "target": 1,
                "reward_points": 20,
                "reward_experience": 10,
                "completed": checked_in,
                "claimed": checked_in,  # 签到即领取
                "claimable": False,
            },
        ],
        "total_reward_available": (
            DAILY_READ_REWARD_POINTS if read_count >= DAILY_READ_TARGET and not read_task_claimed else 0
        ),
    }


@router.post("/claim-daily-task")
async def claim_daily_task(
    task_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """领取每日任务奖励"""
    merged_user = await _get_merged_user(db, current_user)
    today_str = date.today().isoformat()
    today_start = datetime.combine(date.today(), datetime.min.time())

    if task_id == "read_5":
        # 检查是否已领取
        claim_q = select(PointTransaction).where(
            PointTransaction.user_id == merged_user.id,
            PointTransaction.transaction_type == TransactionType.ADMIN.value,
            PointTransaction.description == f"daily_read_task_{today_str}",
        )
        if (await db.execute(claim_q)).scalar_one_or_none():
            raise HTTPException(status_code=400, detail="今日阅读任务奖励已领取")

        # 检查是否读完 5 篇
        read_count_q = (
            select(func.count())
            .select_from(ReadingRecord)
            .where(
                ReadingRecord.user_id == merged_user.id,
                ReadingRecord.created_at >= today_start,
            )
        )
        read_count = await db.scalar(read_count_q) or 0
        if read_count < DAILY_READ_TARGET:
            raise HTTPException(
                status_code=400,
                detail=f"今日仅阅读 {read_count}/{DAILY_READ_TARGET} 篇，完成后可领取",
            )

        # 发放奖励
        merged_user.points += DAILY_READ_REWARD_POINTS
        merged_user.experience += DAILY_READ_REWARD_EXP

        rewards_engine = RewardsEngine()
        new_level = rewards_engine.get_level_from_experience(merged_user.experience)
        if new_level > merged_user.level:
            merged_user.level = new_level

        transaction = PointTransaction(
            user_id=merged_user.id,
            transaction_type=TransactionType.ADMIN.value,
            amount=DAILY_READ_REWARD_POINTS,
            description=f"daily_read_task_{today_str}",
        )
        db.add(transaction)
        await db.commit()

        return {
            "status": "ok",
            "message": f"领取成功！获得 {DAILY_READ_REWARD_POINTS} 积分 + {DAILY_READ_REWARD_EXP} 经验",
            "points_earned": DAILY_READ_REWARD_POINTS,
            "experience_earned": DAILY_READ_REWARD_EXP,
            "new_balance": merged_user.points,
        }

    raise HTTPException(status_code=400, detail="不支持的任务")


# ==============================================================================
# 卡牌合成
# ==============================================================================
RARITY_ORDER = ["N", "R", "SR", "SSR"]
SYNTHESIS_MIN_CARDS = 3


@router.post("/synthesize-cards")
async def synthesize_cards(
    card_ids: List[str] = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """合成卡牌：消耗 3 张同稀有度卡牌 → 1 张更高稀有度卡牌"""
    merged_user = await _get_merged_user(db, current_user)

    if len(card_ids) < SYNTHESIS_MIN_CARDS:
        raise HTTPException(status_code=400, detail=f"至少需要 {SYNTHESIS_MIN_CARDS} 张卡牌才能合成")

    # 查询这些卡牌
    cards_q = select(CardCollection).where(
        CardCollection.id.in_(card_ids),
        CardCollection.user_id == merged_user.id,
    )
    cards = (await db.execute(cards_q)).scalars().all()

    if len(cards) < SYNTHESIS_MIN_CARDS:
        raise HTTPException(status_code=400, detail="部分卡牌不存在或不属于你")

    # 必须是同稀有度
    rarities = set(c.card_rarity for c in cards)
    if len(rarities) > 1:
        raise HTTPException(status_code=400, detail="合成需要同稀有度的卡牌")

    base_rarity = cards[0].card_rarity
    if base_rarity == "SSR":
        raise HTTPException(status_code=400, detail="SSR 卡牌已经是最高稀有度，无法继续合成")

    # 计算目标稀有度
    next_idx = RARITY_ORDER.index(base_rarity) + 1
    new_rarity = RARITY_ORDER[next_idx]

    # 删除被消耗的卡牌
    for c in cards:
        await db.delete(c)

    # 生成新卡牌
    new_content = _generate_card_content(new_rarity)
    new_card = CardCollection(
        user_id=merged_user.id,
        card_name=new_content["card_name"],
        card_rarity=new_rarity,
        card_series=new_content.get("card_series", "合成卡牌"),
        card_type=new_content.get("card_type"),
        description=new_content.get("description"),
        lore=new_content.get("lore"),
        trivia_question=new_content.get("trivia_question"),
        trivia_answer=new_content.get("trivia_answer"),
        is_synthesized=True,
    )
    db.add(new_card)

    # 记录交易
    transaction = PointTransaction(
        user_id=merged_user.id,
        transaction_type=TransactionType.SYNTHESIS.value,
        amount=0,
        description=f"合成 {base_rarity}×{len(cards)} → {new_rarity}（{new_content['card_name']}）",
    )
    db.add(transaction)

    await db.commit()
    await db.refresh(new_card)

    return {
        "status": "ok",
        "message": f"合成成功！获得 {new_rarity} 卡牌「{new_card.card_name}」",
        "new_card": CardCollectionResponse.model_validate(new_card).model_dump(),
    }


# ==============================================================================
# 赠送卡牌给好友
# ==============================================================================
@router.post("/gift-card")
async def gift_card(
    card_id: str = Query(...),
    to_user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """将一张卡牌赠送给好友"""
    merged_user = await _get_merged_user(db, current_user)

    # 检查卡牌
    card_q = select(CardCollection).where(
        CardCollection.id == card_id,
        CardCollection.user_id == merged_user.id,
    )
    card = (await db.execute(card_q)).scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="卡牌不存在或不属于你")

    # 检查接收方
    recipient = await db.get(User, to_user_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="接收方用户不存在")

    if to_user_id == merged_user.id:
        raise HTTPException(status_code=400, detail="不能赠送给自己")

    # 检查是否为好友（需要 Friendship 模型，如果不存在则跳过验证）
    try:
        from app.models.friendship import Friendship
        friend_q = select(Friendship).where(
            ((Friendship.user_id == merged_user.id) & (Friendship.friend_id == to_user_id)) |
            ((Friendship.user_id == to_user_id) & (Friendship.friend_id == merged_user.id)),
            Friendship.status == "accepted",
        )
        friend = (await db.execute(friend_q)).scalar_one_or_none()
        if not friend:
            raise HTTPException(status_code=400, detail="只能给好友赠送卡牌，请先添加好友")
    except ImportError:
        # Friendship 模型不存在时跳过好友验证
        pass

    # 转移卡牌
    card.user_id = to_user_id

    # 记录交易
    transaction = PointTransaction(
        user_id=merged_user.id,
        transaction_type=TransactionType.GIFT_CARD.value,
        amount=0,
        description=f"赠送卡牌「{card.card_name}」给 {recipient.nickname or recipient.email}",
        related_id=card.id,
    )
    db.add(transaction)

    await db.commit()

    return {
        "status": "ok",
        "message": f"已将「{card.card_name}」赠送给 {recipient.nickname or recipient.email}",
    }
