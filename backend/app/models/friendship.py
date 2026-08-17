import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid_str():
    return str(uuid.uuid4())


class Friendship(Base):
    """好友关系：双向存储（A→B 和 B→A 各一条），status=pending/accepted/blocked"""
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),
    )

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    friend_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(20), default="pending", nullable=False, index=True)  # pending / accepted / blocked
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    accepted_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    friend = relationship("User", foreign_keys=[friend_id])
