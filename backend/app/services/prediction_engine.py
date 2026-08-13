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

        recent_query = (
            select(NewsCard)
            .order_by(desc(NewsCard.created_at))
            .limit(20)
        )
        recent_result = await db.execute(recent_query)
        recent_cards = recent_result.scalars().all()

        if len(recent_cards) < min_cards:
            return []

        cards_data = [
            {"title": c.title, "summary": c.summary or "", "id": str(c.id)}
            for c in recent_cards
        ]

        questions = await self.llm_processor.generate_prediction_questions(cards_data)

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
                    expires_at=datetime.utcnow() + timedelta(hours=24),
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