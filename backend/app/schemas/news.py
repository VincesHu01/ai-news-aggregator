from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class NewsCardResponse(BaseModel):
    id: str
    title: str
    summary: Optional[str] = None
    category: Optional[str] = None
    source: str
    source_url: str
    heat_score: float
    ai_value_score: float
    interest_tags: List[str] = []
    cover_image: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    is_read: bool = False

    class Config:
        from_attributes = True


class NewsCardListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[NewsCardResponse]


class ReadingRequest(BaseModel):
    read_duration: int = 30


class ReadingResponse(BaseModel):
    card_id: str
    read_duration: int
    points_earned: int
    experience_earned: int
    new_balance: int


class HeatmapResponse(BaseModel):
    dates: List[str]
    scores: List[float]
    counts: List[int]
