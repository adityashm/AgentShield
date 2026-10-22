import uuid
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import String, Float, Boolean, DateTime, Text, ForeignKey, JSON, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from ..base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Action(Base):
    __tablename__ = "actions"
    __table_args__ = (
        UniqueConstraint("org_id", "event_id", name="uq_action_org_event_id"),
        Index("ix_actions_org_timestamp", "org_id", "timestamp"),
        Index("ix_actions_org_agent_timestamp", "org_id", "agent_id", "timestamp"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id: Mapped[str] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True, default="org_default")
    agent_id: Mapped[str] = mapped_column(String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True, index=True)
    
    event_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True, default=generate_uuid)
    parent_event_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    trace_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    
    action_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    tool_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="started", nullable=False)
    
    parameters: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    output_excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    clock_skew: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    features: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    rule_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), default="low", nullable=False)
    decision: Mapped[str] = mapped_column(String(32), default="allow", nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    matched_rules: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __init__(self, **kwargs):
        if "action_id" in kwargs:
            kwargs.setdefault("id", kwargs["action_id"])
            kwargs.setdefault("event_id", kwargs["action_id"])
            kwargs.pop("action_id", None)
        elif "id" in kwargs and "event_id" not in kwargs:
            kwargs.setdefault("event_id", kwargs["id"])
        if "parameters_json" in kwargs:
            p_json = kwargs.pop("parameters_json")
            try:
                kwargs.setdefault("parameters", json.loads(p_json) if p_json else {})
            except Exception:
                kwargs.setdefault("parameters", {})
        super().__init__(**kwargs)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="actions")
    agent: Mapped["Agent"] = relationship("Agent", back_populates="actions")
    session: Mapped[Optional["SessionModel"]] = relationship("SessionModel", back_populates="actions")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="action", cascade="all, delete-orphan")

    # Synonym for backward compatibility
    action_id = synonym("id")

    @property
    def parameters_json(self) -> str:
        return json.dumps(self.parameters or {})

    @parameters_json.setter
    def parameters_json(self, val: str):
        try:
            self.parameters = json.loads(val) if val else {}
        except Exception:
            self.parameters = {}
