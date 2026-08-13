import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid_str():
    return str(uuid.uuid4())


class Share(Base):
    __tablename__ = "shares"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    target_type = Column(String(50), nullable=False)
    target_id = Column(String(36), nullable=False)
    click_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="shares")


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    invite_code = Column(String(20), unique=True, nullable=False, index=True)
    used_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    used_at = Column(DateTime, nullable=True)
    reward_points = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id], back_populates="invitations")
    used_by_user = relationship("User", foreign_keys=[used_by])
