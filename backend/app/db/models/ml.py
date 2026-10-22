import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class MLModel(Base):
    __tablename__ = "ml_models"
    __table_args__ = (
        Index("ix_ml_models_org_scope_active", "org_id", "scope", "is_active"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    scope: Mapped[str] = mapped_column(String(32), default="global", nullable=False)  # global, org, agent
    agent_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    feature_set: Mapped[str] = mapped_column(String(32), default="v1", nullable=False)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    n_samples: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    params: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    calibration: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {"p50": 0.0, "p99": 1.0}, nullable=False)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
