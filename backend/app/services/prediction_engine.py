import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.predictions import Prediction, PredictionBet, PredictionStatus
from app.models.user import User
from app.services.llm_processor import LLMProcessor

logger = logging.getLogger(__name__)


class PredictionEngine:
    def __init__(self):
        self.llm_processor = LLMProcessor()

    async def generate_predictions_from_cards(
        self, db: AsyncSession, min_cards: int = 3
    ) -> List[Prediction]:
        from app.models.news import NewsCard

        # 如果预测表为空，先注入一批种子预测，避免新用户/新部署看到空白页面
        count_q = select(func.count(Prediction.id))
        existing_count = await db.scalar(count_q) or 0
        if existing_count == 0:
            logger.info("预测表为空，注入 12 条种子预测...")
            seeds = self._get_seed_predictions()
            for q in seeds:
                try:
                    p = Prediction(
                        question=q["question"],
                        prediction_type=q.get("type", "yes_no"),
                        options=q.get("options", ["是", "否"]),
                        category=q.get("category", "综合"),
                        status=PredictionStatus.PENDING.value,
                        settlement_logic=q.get("settlement_logic", ""),
                        expires_at=q.get("expires_at"),
                    )
                    db.add(p)
                except Exception as e:
                    logger.error(f"插入种子预测失败: {str(e)[:200]}")
            await db.commit()

        recent_query = (
            select(NewsCard)
            .order_by(desc(NewsCard.created_at))
            .limit(20)
        )
        recent_result = await db.execute(recent_query)
        recent_cards = recent_result.scalars().all()

        if len(recent_cards) < min_cards:
            # 即使近期卡片少，也返回已存在的预测引用（通过上层重新加载，这里仅避免返回空）
            return []

        cards_data = [
            {"title": c.title, "summary": c.summary or "", "id": str(c.id)}
            for c in recent_cards
        ]

        questions = await self.llm_processor.generate_prediction_questions(cards_data)
        # LLM 失败兜底：生成 2-3 条基于标题关键词的默认预测
        if not questions:
            questions = self._fallback_predictions_from_cards(cards_data)

        predictions = []
        for q in questions:
            try:
                prediction = Prediction(
                    question=q.get("question", ""),
                    prediction_type=q.get("type", "yes_no"),
                    options=q.get("options", ["是", "否"]),
                    category=q.get("category", "其他"),
                    status=PredictionStatus.PENDING.value,
                    llm_source_card_ids=[c["id"] for c in cards_data[:5]],
                    settlement_logic=q.get("settlement_logic", ""),
                    expires_at=q.get("expires_at") or (datetime.utcnow() + timedelta(hours=24)),
                )
                db.add(prediction)
                predictions.append(prediction)
            except Exception as e:
                logger.error(f"创建预测失败: {str(e)[:200]}")

        if predictions:
            await db.commit()
            for p in predictions:
                await db.refresh(p)

        return predictions

    # --- 种子预测 & 兜底 ---
    @staticmethod
    def _get_seed_predictions() -> List[Dict]:
        from datetime import timedelta
        near_expire = datetime.utcnow() + timedelta(days=7)
        mid_expire = datetime.utcnow() + timedelta(days=30)
        far_expire = datetime.utcnow() + timedelta(days=90)
        return [
            {
                "question": "2026 年 12 月 31 日前，OpenAI 会正式发布 GPT-5 吗？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "大模型",
                "settlement_logic": "依据 OpenAI 官方发布会/GPT-5 产品正式上线公告判定",
                "expires_at": far_expire,
            },
            {
                "question": "Google Gemini（含后续版本）是否会在 2026 年 11 月前推出多模态能力超越 GPT-4o 的版本？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "大模型",
                "settlement_logic": "以 Google DeepMind 官方博客或权威第三方评测 MMLU/MATH/Multimodal 榜单综合判定",
                "expires_at": mid_expire,
            },
            {
                "question": "2026 年内 Claude Code 或其升级版本的用户数是否超过 1000 万月活？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "AI编程工具",
                "settlement_logic": "以 Anthropic 官方公布数据、或外部权威调研机构（如 SimilarWeb/SensorTower）数据为准",
                "expires_at": far_expire,
            },
            {
                "question": "2026 年 10 月 1 日前，DeepSeek 的开源大模型（≥70B 参数级）是否进入 Hugging Face 热门排行榜 Top 5？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "大模型",
                "settlement_logic": "以 Hugging Face 官方 7 日下载/点赞/收藏综合榜单公开数据为依据",
                "expires_at": mid_expire,
            },
            {
                "question": "xAI 的 Grok 系列是否会在 2026 年 9 月前开源任意一款核心预训练模型权重？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "开源",
                "settlement_logic": "以 xAI 官方 GitHub 账号发布模型权重、或 Elon Musk 官方公开确认视为成立",
                "expires_at": mid_expire,
            },
            {
                "question": "Cursor 是否在 2026 年底之前推出中文独立版本（即非英文软件汉化版）？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "AI编程工具",
                "settlement_logic": "以 Anysphere/Cursor 团队发布面向中文用户的独立发行版或独立中文社区版（非语言包汉化）为准",
                "expires_at": far_expire,
            },
            {
                "question": "到 2026 年 12 月，全球 AI 监管法案（例如欧盟 AI Act 实际执行）是否会对大模型推理实施强制成本？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "政策",
                "settlement_logic": "以欧盟、美国国会或中国发布正式立法/法规并开始生效的官方公告为准",
                "expires_at": far_expire,
            },
            {
                "question": "Transformer 架构是否仍是 2026 年主流大模型的核心架构？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "AI研究",
                "settlement_logic": "以 OpenAI / Google DeepMind / Anthropic / Meta 四个厂商中任意三家发布的最主流旗舰模型公开架构说明为准，三家仍然是 Transformer 即为成立",
                "expires_at": far_expire,
            },
            {
                "question": "2026 年第三季度末，是否会有一款「端侧运行 ≥ 100B 参数 LLM」的消费级手机芯片公开量产？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "AI芯片",
                "settlement_logic": "以 Apple / Qualcomm / MediaTek 等手机 SoC 厂商公开的 NPU 规格或权威评测机构实测为准",
                "expires_at": mid_expire,
            },
            {
                "question": "2026 年底前，Meta 开源的 Llama 系列 ≥ 400B 级别是否有可商用版本？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "开源",
                "settlement_logic": "以 Meta AI 官网及 Hugging Face 公开的 Model License 为准",
                "expires_at": far_expire,
            },
            {
                "question": "2026 年 8 月底，中国国产大模型（通义千问、Kimi、DeepSeek 等）在中文评测基准 CMMLU 平均得分是否 ≥ 90？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "大模型",
                "settlement_logic": "以 CMMLU 官方榜单公开的 Top 10 国产模型平均分数（≥7B 模型组）为准",
                "expires_at": near_expire,
            },
            {
                "question": "2026 年 9 月 1 日前，AI 编程工具是否覆盖全球 ≥ 20% 专业开发者（按 GitHub/StackOverFlow 调研）？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "AI应用",
                "settlement_logic": "以 Stack Overflow 2026 开发者调查 / GitHub Octoverse 官方数据为准",
                "expires_at": near_expire,
            },
        ]

    @staticmethod
    def _fallback_predictions_from_cards(cards_data: List[Dict]) -> List[Dict]:
        from datetime import timedelta
        expires = datetime.utcnow() + timedelta(days=14)
        # 简单基于输入卡片的关键词猜测 2 条预测
        combined_title = " ".join(c.get("title", "") for c in cards_data[:5]).lower()
        keywords = [
            ("GPT", "2026 年内 GPT 系列模型是否会新增可公开调用的实时搜索联网能力？"),
            ("Gemini", "Google Gemini 会在 2026 年推出支持长视频理解的版本吗？"),
            ("Claude", "Claude 系列是否会在 2026 年推出开源版本？"),
            ("DeepSeek", "DeepSeek 系列是否在 2026 年 Q3 前登顶任意权威中文大模型榜单 Top1？"),
            ("Grok", "Grok 系列模型是否会在 2026 年接入 Twitter/X 主站搜索？"),
            ("Cursor", "Cursor 在 2026 年内是否会上线多人协作实时结对编程功能？"),
            ("Transformer", "2026 年内 Transformer 是否仍是 GPT/Gemini/Claude 三大系列的核心架构？"),
            ("LLM", "2026 年底是否会有单模型参数规模超过 10 万亿的大模型？"),
            ("Agent", "2026 年 Q3 前 AI Agent 是否开始进入普通消费者日常使用？"),
        ]
        picks = []
        for kw, q in keywords:
            if kw.lower() in combined_title and len(picks) < 3:
                picks.append({
                    "question": q,
                    "type": "yes_no",
                    "options": ["是", "否"],
                    "category": "LLM兜底生成",
                    "settlement_logic": f"依据公开权威来源判断：{kw} 相关",
                    "expires_at": expires,
                })
        if not picks:
            picks.append({
                "question": "2026 年底，全球月活最大的 AI 对话产品是否仍是 ChatGPT？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "大模型",
                "settlement_logic": "按官方公开月活数据或权威第三方市场调研（SimilarWeb/SensorTower）",
                "expires_at": expires,
            })
            picks.append({
                "question": "2026 年大模型推理成本是否会比 2025 年再下降 ≥ 50%？",
                "type": "yes_no",
                "options": ["是", "否"],
                "category": "AI研究",
                "settlement_logic": "对比公开的每 1000 token 推理成本中位数",
                "expires_at": expires,
            })
        return picks


    async def calculate_odds(
        self,
        prediction_id: str,
        choice: str,
        db: AsyncSession,
    ) -> float:
        bets_query = select(PredictionBet).where(
            PredictionBet.prediction_id == prediction_id
        )
        bets_result = await db.execute(bets_query)
        all_bets = bets_result.scalars().all()

        choice_bets = [b for b in all_bets if b.choice == choice]
        total_amount = sum(b.amount for b in all_bets)
        choice_amount = sum(b.amount for b in choice_bets)

        if total_amount == 0 or choice_amount == 0:
            return 2.0

        implied_probability = choice_amount / total_amount
        if implied_probability == 0:
            return 10.0

        odds = round(1.0 / implied_probability, 2)
        return min(max(odds, 1.1), 20.0)

    async def place_bet(
        self,
        user: User,
        prediction: Prediction,
        choice: str,
        amount: int,
        db: AsyncSession,
    ) -> Optional[PredictionBet]:
        if user.points < amount:
            return None

        if prediction.status != PredictionStatus.PENDING.value:
            return None

        if prediction.expires_at < datetime.utcnow():
            return None

        odds = await self.calculate_odds(prediction.id, choice, db)

        bet = PredictionBet(
            user_id=user.id,
            prediction_id=prediction.id,
            choice=choice,
            amount=amount,
            odds=odds,
        )
        db.add(bet)

        user.points -= amount

        from app.models.rewards import PointTransaction, TransactionType
        transaction = PointTransaction(
            user_id=user.id,
            transaction_type=TransactionType.PREDICTION_BET.value,
            amount=-amount,
            description=f"预测投注: {prediction.question[:50]}",
            related_id=prediction.id,
        )
        db.add(transaction)

        await db.commit()
        await db.refresh(bet)
        return bet

    async def settle_predictions(self, db: Optional[AsyncSession] = None):
        from app.database import async_session

        own_session = False
        if db is None:
            db = async_session()
            own_session = True

        try:
            pending_query = select(Prediction).where(
                Prediction.status == PredictionStatus.PENDING.value,
                Prediction.expires_at < datetime.utcnow(),
            )
            pending_result = await db.execute(pending_query)
            predictions = pending_result.scalars().all()

            for prediction in predictions:
                try:
                    cards_data = await self._get_source_cards_data(db, prediction)

                    result = await self.llm_processor.settle_prediction(
                        {
                            "question": prediction.question,
                            "type": prediction.prediction_type,
                            "options": prediction.options,
                            "settlement_logic": prediction.settlement_logic,
                        },
                        cards_data,
                    )

                    if result:
                        prediction.status = PredictionStatus.SETTLED.value
                        prediction.result = result
                        prediction.settled_at = datetime.utcnow()

                        await self._distribute_winnings(db, prediction, result)
                    else:
                        prediction.status = PredictionStatus.CANCELLED.value
                        prediction.settled_at = datetime.utcnow()

                        await self._refund_bets(db, prediction)

                except Exception as e:
                    logger.error(f"结算预测 {prediction.id} 失败: {str(e)[:200]}")
                    prediction.status = PredictionStatus.CANCELLED.value
                    prediction.settled_at = datetime.utcnow()
                    await self._refund_bets(db, prediction)

            if predictions:
                await db.commit()

        except Exception as e:
            logger.error(f"批量结算预测失败: {str(e)[:200]}")
            if own_session:
                await db.rollback()
            raise
        finally:
            if own_session:
                await db.close()

    async def _get_source_cards_data(
        self, db: AsyncSession, prediction: Prediction
    ) -> List[Dict]:
        from app.models.news import NewsCard

        card_ids = prediction.llm_source_card_ids or []
        if not card_ids:
            recent_query = (
                select(NewsCard)
                .order_by(desc(NewsCard.created_at))
                .limit(10)
            )
            recent_result = await db.execute(recent_query)
            recent_cards = recent_result.scalars().all()
            return [
                {
                    "title": c.title,
                    "summary": c.summary or "",
                    "id": str(c.id),
                }
                for c in recent_cards
            ]

        cards_data = []
        for cid in card_ids:
            try:
                card_query = select(NewsCard).where(NewsCard.id == str(cid))
                card_result = await db.execute(card_query)
                card = card_result.scalar_one_or_none()
                if card:
                    cards_data.append(
                        {
                            "title": card.title,
                            "summary": card.summary or "",
                            "id": str(card.id),
                        }
                    )
            except (ValueError, TypeError):
                continue
        return cards_data

    async def _distribute_winnings(
        self, db: AsyncSession, prediction: Prediction, result: str
    ):
        bets_query = select(PredictionBet).where(
            PredictionBet.prediction_id == prediction.id,
        )
        bets_result = await db.execute(bets_query)
        all_bets = bets_result.scalars().all()

        total_pool = sum(b.amount for b in all_bets)
        winning_bets = [b for b in all_bets if b.choice == result]
        losing_bets = [b for b in all_bets if b.choice != result]

        winning_total = sum(b.amount for b in winning_bets)
        if winning_total == 0:
            return

        for bet in winning_bets:
            winnings = int(bet.amount * (total_pool / winning_total) * 0.95)
            bet.payout = winnings
            bet.status = "won"

            user_query = select(User).where(User.id == bet.user_id)
            user_result = await db.execute(user_query)
            user = user_result.scalar_one_or_none()
            if user:
                user.points += winnings

                from app.models.rewards import PointTransaction, TransactionType
                transaction = PointTransaction(
                    user_id=user.id,
                    transaction_type=TransactionType.PREDICTION_WIN.value,
                    amount=winnings,
                    description=f"预测中奖: {prediction.question[:50]}",
                    related_id=prediction.id,
                )
                db.add(transaction)

        for bet in losing_bets:
            bet.status = "lost"

    async def _refund_bets(self, db: AsyncSession, prediction: Prediction):
        bets_query = select(PredictionBet).where(
            PredictionBet.prediction_id == prediction.id,
        )
        bets_result = await db.execute(bets_query)
        all_bets = bets_result.scalars().all()

        for bet in all_bets:
            bet.status = "refunded"

            user_query = select(User).where(User.id == bet.user_id)
            user_result = await db.execute(user_query)
            user = user_result.scalar_one_or_none()
            if user:
                user.points += bet.amount

                from app.models.rewards import PointTransaction, TransactionType
                transaction = PointTransaction(
                    user_id=user.id,
                    transaction_type=TransactionType.PREDICTION_WIN.value,
                    amount=bet.amount,
                    description=f"预测退款: {prediction.question[:50]}",
                    related_id=prediction.id,
                )
                db.add(transaction)