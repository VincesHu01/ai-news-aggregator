import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
import enum

from app.database import Base


def _uuid_str():
    return str(uuid.uuid4())


class PredictionType(str, enum.Enum):
    YES_NO = "yes_no"
    RANGE = "range"
    MULTIPLE_CHOICE = "multiple_choice"


class PredictionStatus(str, enum.Enum):
    PENDING = "pending"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    question = Column(Text, nullable=False)
    prediction_type = Column(String(30), nullable=False, default=PredictionType.YES_NO.value)
    options = Column(JSON, default=list, nullable=False)
    category = Column(String(50), nullable=True, index=True)
    status = Column(String(30), default=PredictionStatus.PENDING.value, nullable=False, index=True)
    result = Column(String(200), nullable=True)
    llm_source_card_ids = Column(JSON, default=list, nullable=False)
    settlement_logic = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    settled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    bets = relationship("PredictionBet", back_populates="prediction", cascade="all, delete-orphan")


class PredictionBet(Base):
    __tablename__ = "prediction_bets"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    prediction_id = Column(String(36), ForeignKey("predictions.id"), nullable=False, index=True)
    choice = Column(String(200), nullable=False)
    amount = Column(Integer, nullable=False)
    odds = Column(Float, default=1.0, nullable=False)
    payout = Column(Integer, default=0, nullable=False)
    status = Column(String(30), default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="bets")
    prediction = relationship("Prediction", back_populates="bets")
