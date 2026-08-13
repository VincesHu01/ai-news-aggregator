from datetime import datetime, date
import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.models.user import User
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

    rarity_names = {
        "SSR": "传说",
        "SR": "史诗",
        "R": "稀有",
        "N": "普通",
    }

    card = CardCollection(
        user_id=merged_user.id,
        card_name=f"{rarity_names.get(rarity, '')}卡片",
        card_rarity=rarity,
        card_series=card_series or "AI新闻精选",
        source_card_id=source_card.id if source_card else None,
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
