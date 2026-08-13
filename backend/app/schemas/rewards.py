from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CardCollectionResponse(BaseModel):
    id: str
    card_name: str
    card_rarity: str
    card_series: Optional[str] = None
    card_image: Optional[str] = None
    source_card_id: Optional[str] = None
    obtained_at: datetime

    class Config:
        from_attributes = True


class CheckinResponse(BaseModel):
    id: str
    checkin_date: str
    streak_days: int
    earned_points: int
    earned_experience: int
    created_at: datetime

    class Config:
        from_attributes = True


class PointBalanceResponse(BaseModel):
    points: int
    experience: int
    level: int
    intelligence: int
    next_level_experience: int
    total_checkins: int
    cards_collected: int


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    score: int
    level: int


class DrawCardResponse(BaseModel):
    card: CardCollectionResponse
    points_remaining: int


class CheckinRequest(BaseModel):
    pass


class DrawCardRequest(BaseModel):
    card_series: Optional[str] = None
