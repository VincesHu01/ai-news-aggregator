from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.predictions import Prediction, PredictionBet, PredictionStatus
from app.schemas.predictions import (
    PredictionResponse,
    PredictionListResponse,
    CreateBetRequest,
    BetResponse,
    PredictionDetailResponse,
)
from app.utils.security import get_current_user
from app.services.prediction_engine import PredictionEngine

router = APIRouter()


async def _get_merged_user(db: AsyncSession, current_user: User) -> User:
    merged = await db.get(User, current_user.id)
    if not merged:
        raise HTTPException(status_code=401, detail="用户不存在")
    return merged


@router.get("/", response_model=PredictionListResponse)
async def list_predictions(
    status_filter: Optional[str] = Query(None, pattern="^(pending|settled|cancelled)$"),
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Prediction)

    if status_filter:
        query = query.where(Prediction.status == status_filter)
    if category:
        query = query.where(Prediction.category == category)

    query = query.order_by(desc(Prediction.expires_at))
    result = await db.execute(query)
    predictions = result.scalars().all()

    items = []
    for p in predictions:
        bet_count_query = select(func.count(PredictionBet.id)).where(
            PredictionBet.prediction_id == p.id
        )
        total_bets = await db.scalar(bet_count_query) or 0

        amount_query = select(func.coalesce(func.sum(PredictionBet.amount), 0)).where(
            PredictionBet.prediction_id == p.id
        )
        total_amount = await db.scalar(amount_query) or 0

        pred_data = PredictionResponse.model_validate(p)
        pred_data.total_bets = total_bets
        pred_data.total_amount = total_amount
        items.append(pred_data)

    return PredictionListResponse(total=len(items), items=items)


@router.get("/{prediction_id}", response_model=PredictionDetailResponse)
async def get_prediction(
    prediction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Prediction).where(Prediction.id == prediction_id)
    )
    prediction = result.scalar_one_or_none()

    if not prediction:
        raise HTTPException(status_code=404, detail="预测不存在")

    bet_count_query = select(func.count(PredictionBet.id)).where(
        PredictionBet.prediction_id == prediction_id
    )
    total_bets = await db.scalar(bet_count_query) or 0

    amount_query = select(func.coalesce(func.sum(PredictionBet.amount), 0)).where(
        PredictionBet.prediction_id == prediction_id
    )
    total_amount = await db.scalar(amount_query) or 0

    pred_data = PredictionResponse.model_validate(prediction)
    pred_data.total_bets = total_bets
    pred_data.total_amount = total_amount

    my_bets_query = select(PredictionBet).where(
        PredictionBet.prediction_id == prediction_id,
        PredictionBet.user_id == current_user.id,
    ).order_by(desc(PredictionBet.created_at))
    my_bets_result = await db.execute(my_bets_query)
    my_bets = my_bets_result.scalars().all()

    pred_detail = PredictionDetailResponse(**pred_data.model_dump())
    pred_detail.my_bets = [BetResponse.model_validate(b) for b in my_bets]

    return pred_detail


@router.post("/{prediction_id}/bet", response_model=BetResponse)
async def place_bet(
    prediction_id: str,
    bet_data: CreateBetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    merged_user = await _get_merged_user(db, current_user)

    result = await db.execute(
        select(Prediction).where(Prediction.id == prediction_id)
    )
    prediction = result.scalar_one_or_none()

    if not prediction:
        raise HTTPException(status_code=404, detail="预测不存在")

    if prediction.status != PredictionStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="预测已结束")

    if prediction.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="预测已过期")

    if merged_user.points < bet_data.amount:
        raise HTTPException(status_code=400, detail="积分不足")

    engine = PredictionEngine()
    odds = await engine.calculate_odds(prediction_id, bet_data.choice, db)

    bet = PredictionBet(
        user_id=merged_user.id,
        prediction_id=prediction_id,
        choice=bet_data.choice,
        amount=bet_data.amount,
        odds=odds,
    )
    db.add(bet)

    merged_user.points -= bet_data.amount

    from app.models.rewards import PointTransaction, TransactionType
    transaction = PointTransaction(
        user_id=merged_user.id,
        transaction_type=TransactionType.PREDICTION_BET.value,
        amount=-bet_data.amount,
        description=f"参与预测投注: {prediction.question[:50]}",
        related_id=prediction_id,
    )
    db.add(transaction)

    await db.commit()
    await db.refresh(bet)

    return BetResponse.model_validate(bet)


@router.get("/{prediction_id}/bets", response_model=list[BetResponse])
async def get_prediction_bets(
    prediction_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Prediction).where(Prediction.id == prediction_id)
    )
    prediction = result.scalar_one_or_none()

    if not prediction:
        raise HTTPException(status_code=404, detail="预测不存在")

    bets_query = select(PredictionBet).where(
        PredictionBet.prediction_id == prediction_id,
        PredictionBet.user_id == current_user.id,
    ).order_by(desc(PredictionBet.created_at))

    bets_result = await db.execute(bets_query)
    bets = bets_result.scalars().all()

    return [BetResponse.model_validate(b) for b in bets]
