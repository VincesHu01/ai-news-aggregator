from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String

from app.database import Base


class DeliveryControl(Base):
    """Single-row global switch for generation, web ingest and Feishu delivery."""

    __tablename__ = "delivery_control"

    id = Column(String(32), primary_key=True, default="global")
    enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by = Column(String(100), nullable=True)
