from app.models.user import User
from app.models.news import NewsCard, ReadingRecord
from app.models.rewards import CardCollection, Checkin, PointTransaction
from app.models.predictions import Prediction, PredictionBet
from app.models.shares import Share, Invitation

__all__ = [
    "User",
    "NewsCard",
    "ReadingRecord",
    "CardCollection",
    "Checkin",
    "PointTransaction",
    "Prediction",
    "PredictionBet",
    "Share",
    "Invitation",
]