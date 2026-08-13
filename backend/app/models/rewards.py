import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
import enum

from app.database import Base


def _uuid_str():
    return str(uuid.uuid4())


class CardRarity(str, enum.Enum):
    SSR = "SSR"
    SR = "SR"
    R = "R"
    N = "N"


class TransactionType(str, enum.Enum):
    READING = "reading"
    CHECKIN = "checkin"
    DRAW_CARD = "draw_card"
    PREDICTION_BET = "prediction_bet"
    PREDICTION_WIN = "prediction_win"
    SHARE = "share"
    INVITE = "invite"
    ADMIN = "admin"


class CardCollection(Base):
    __tablename__ = "card_collections"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    card_name = Column(String(200), nullable=False)
    card_rarity = Column(String(10), nullable=False)
    card_series = Column(String(100), nullable=True)
    card_image = Column(String(1000), nullable=True)
    source_card_id = Column(String(36), ForeignKey("news_cards.id"), nullable=True)
    obtained_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="card_collections")


class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    checkin_date = Column(String(20), nullable=False, index=True)
    streak_days = Column(Integer, default=1, nullable=False)
    earned_points = Column(Integer, default=0, nullable=False)
    earned_experience = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="checkins")


class PointTransaction(Base):
    __tablename__ = "point_transactions"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    transaction_type = Column(String(30), nullable=False)
    amount = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    related_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="point_transactions")
