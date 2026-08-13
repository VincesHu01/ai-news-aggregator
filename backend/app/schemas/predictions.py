from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime


class PredictionResponse(BaseModel):
    id: str
    question: str
    prediction_type: str
    options: List[Any]
    category: Optional[str] = None
    status: str
    result: Optional[str] = None
    expires_at: datetime
    settled_at: Optional[datetime] = None
    created_at: datetime
    total_bets: int = 0
    total_amount: int = 0

    class Config:
        from_attributes = True


class PredictionListResponse(BaseModel):
    total: int
    items: List[PredictionResponse]


class CreateBetRequest(BaseModel):
    choice: str
    amount: int = 10


class BetResponse(BaseModel):
    id: str
    prediction_id: str
    choice: str
    amount: int
    odds: float
    payout: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PredictionDetailResponse(PredictionResponse):
    my_bets: List[BetResponse] = []
    current_odds: Optional[dict] = None
