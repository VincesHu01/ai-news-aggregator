import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, JSON, Index
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid_str():
    return str(uuid.uuid4())


class NewsCard(Base):
    __tablename__ = "news_cards"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    title = Column(String(500), nullable=False)
    summary = Column(Text, nullable=True)
    category = Column(String(50), nullable=True, index=True)
    source = Column(String(100), nullable=False)
    source_url = Column(String(1000), nullable=False)
    source_id = Column(String(200), nullable=True, index=True)
    heat_score = Column(Float, default=0.0, nullable=False)
    ai_value_score = Column(Float, default=0.0, nullable=False)
    interest_tags = Column(JSON, default=list, nullable=False)
    cover_image = Column(String(1000), nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    reading_records = relationship("ReadingRecord", back_populates="card", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_news_cards_category_created", "category", "created_at"),
    )


class ReadingRecord(Base):
    __tablename__ = "reading_records"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    card_id = Column(String(36), ForeignKey("news_cards.id"), nullable=False, index=True)
    read_duration = Column(Integer, default=0, nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="reading_records")
    card = relationship("NewsCard", back_populates="reading_records")
