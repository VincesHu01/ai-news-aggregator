from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime, timedelta

from app.database import get_db
from app.models.user import User
from app.models.news import NewsCard, ReadingRecord
from app.schemas.news import (
    NewsCardResponse,
    NewsCardListResponse,
    ReadingRequest,
    ReadingResponse,
    HeatmapResponse,
)
from app.utils.security import get_current_user, get_optional_current_user
from app.services.rewards_engine import RewardsEngine

router = APIRouter()


@router.get("/", response_model=NewsCardListResponse)
async def list_news(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("published_at", pattern="^(published_at|heat_score|ai_value_score|created_at)$"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    query = select(NewsCard)

    if category:
        query = query.where(NewsCard.category == category)
    if source:
        query = query.where(NewsCard.source == source)
    if search:
        query = query.where(
            NewsCard.title.ilike(f"%{search}%") | NewsCard.summary.ilike(f"%{search}%")
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    sort_column = {
        "published_at": NewsCard.published_at,
        "heat_score": NewsCard.heat_score,
        "ai_value_score": NewsCard.ai_value_score,
        "created_at": NewsCard.created_at,
    }.get(sort_by, NewsCard.published_at)

    query = query.order_by(desc(sort_column))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    cards = result.scalars().all()

    read_ids = set()
    if current_user:
        read_query = select(ReadingRecord.card_id).where(
            ReadingRecord.user_id == current_user.id
        )
        read_result = await db.execute(read_query)
        read_ids = {row[0] for row in read_result.scalars().all()}

    items = []
    for card in cards:
        card_data = NewsCardResponse.model_validate(card)
        card_data.is_read = card.id in read_ids
        items.append(card_data)

    return NewsCardListResponse(
        total=total or 0,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dates = []
    scores = []
    counts = []
    today = datetime.utcnow().date()

    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)

        cards_query = select(NewsCard).where(
            NewsCard.created_at >= day_start,
            NewsCard.created_at < day_end,
        )
        cards_result = await db.execute(cards_query)
        day_cards = cards_result.scalars().all()

        dates.append(day.isoformat())
        counts.append(len(day_cards))
        avg_score = (
            sum(c.heat_score for c in day_cards) / len(day_cards)
            if day_cards
            else 0.0
        )
        scores.append(round(avg_score, 2))

    return HeatmapResponse(dates=dates, scores=scores, counts=counts)


@router.get("/{card_id}", response_model=NewsCardResponse)
async def get_card(
    card_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(NewsCard).where(NewsCard.id == card_id))
    card = result.scalar_one_or_none()

    if not card:
        raise HTTPException(status_code=404, detail="卡片不存在")

    read_query = select(ReadingRecord).where(
        ReadingRecord.user_id == current_user.id,
        ReadingRecord.card_id == card_id,
    )
    read_result = await db.execute(read_query)
    is_read = read_result.scalar_one_or_none() is not None

    card_data = NewsCardResponse.model_validate(card)
    card_data.is_read = is_read
    return card_data


@router.post("/{card_id}/read", response_model=ReadingResponse)
async def mark_as_read(
    card_id: str,
    read_data: ReadingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Merge user into current session
    merged_user = await db.get(User, current_user.id)
    if not merged_user:
        raise HTTPException(status_code=401, detail="用户不存在")

    result = await db.execute(select(NewsCard).where(NewsCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="卡片不存在")

    existing_query = select(ReadingRecord).where(
        ReadingRecord.user_id == merged_user.id,
        ReadingRecord.card_id == card_id,
    )
    existing_result = await db.execute(existing_query)
    existing = existing_result.scalar_one_or_none()

    rewards_engine = RewardsEngine()

    if existing:
        existing.read_duration = max(existing.read_duration, read_data.read_duration)
        points_earned, exp_earned = rewards_engine.calculate_reading_rewards(
            read_data.read_duration
        )
    else:
        record = ReadingRecord(
            user_id=merged_user.id,
            card_id=card_id,
            read_duration=read_data.read_duration,
        )
        db.add(record)
        points_earned, exp_earned = rewards_engine.calculate_reading_rewards(
            read_data.read_duration
        )

    merged_user.points += points_earned
    merged_user.experience += exp_earned

    new_level = rewards_engine.get_level_from_experience(merged_user.experience)
    if new_level > merged_user.level:
        merged_user.level = new_level

    await db.commit()
    await db.refresh(merged_user)

    return ReadingResponse(
        card_id=card_id,
        read_duration=read_data.read_duration,
        points_earned=points_earned,
        experience_earned=exp_earned,
        new_balance=merged_user.points,
    )