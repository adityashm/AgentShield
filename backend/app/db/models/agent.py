import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from ..base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Agent(Base):
    __tablename__ = "agents"
    __table_args__ = (
        UniqueConstraint("org_id", "external_id", name="uq_agent_org_ext_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id: Mapped[str] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True, default="org_default")
    external_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True, default=generate_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    framework: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    environment: Mapped[str] = mapped_column(String(64), default="production", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)  # active, quarantined, halted
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __init__(self, **kwargs):
        if "agent_id" in kwargs:
            kwargs.setdefault("id", kwargs["agent_id"])
            kwargs.setdefault("external_id", kwargs["agent_id"])
            kwargs.pop("agent_id", None)
        elif "id" in kwargs and "external_id" not in kwargs:
            kwargs.setdefault("external_id", kwargs["id"])
        elif "external_id" in kwargs and "id" not in kwargs:
            kwargs.setdefault("id", kwargs["external_id"])
        if "current_risk_score" in kwargs:
            kwargs.setdefault("risk_score", kwargs.pop("current_risk_score"))
        super().__init__(**kwargs)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="agents")
    actions: Mapped[List["Action"]] = relationship("Action", back_populates="agent", cascade="all, delete-orphan")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="agent", cascade="all, delete-orphan")
    sessions: Mapped[List["SessionModel"]] = relationship("SessionModel", back_populates="agent", cascade="all, delete-orphan")

    # Synonyms for backward compatibility
    agent_id = synonym("id")
    current_risk_score = synonym("risk_score")
