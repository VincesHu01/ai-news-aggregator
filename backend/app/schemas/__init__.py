from app.schemas.user import UserCreate, UserLogin, UserResponse, UserProfile, TokenResponse
from app.schemas.news import NewsCardResponse, NewsCardListResponse, ReadingRequest, ReadingResponse
from app.schemas.rewards import (
    CardCollectionResponse,
    CheckinResponse,
    PointBalanceResponse,
    LeaderboardEntry,
    DrawCardResponse,
)
from app.schemas.predictions import (
    PredictionResponse,
    CreateBetRequest,
    BetResponse,
    PredictionListResponse,
)