import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid_str():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(50), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    level = Column(Integer, default=1, nullable=False)
    experience = Column(Integer, default=0, nullable=False)
    points = Column(Integer, default=100, nullable=False)
    intelligence = Column(Integer, default=0, nullable=False)
    invite_code = Column(String(20), unique=True, nullable=False, index=True)
    invited_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    inviter = relationship("User", remote_side=[id], backref="invitees")
    reading_records = relationship("ReadingRecord", back_populates="user", cascade="all, delete-orphan")
    card_collections = relationship("CardCollection", back_populates="user", cascade="all, delete-orphan")
    checkins = relationship("Checkin", back_populates="user", cascade="all, delete-orphan")
    point_transactions = relationship("PointTransaction", back_populates="user", cascade="all, delete-orphan")
    bets = relationship("PredictionBet", back_populates="user", cascade="all, delete-orphan")
    shares = relationship("Share", back_populates="user", cascade="all, delete-orphan")
    invitations = relationship("Invitation", foreign_keys="Invitation.user_id", back_populates="user", cascade="all, delete-orphan")
    invitation_uses = relationship("Invitation", foreign_keys="Invitation.used_by", back_populates="used_by_user")
