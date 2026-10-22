import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Float, Integer, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from ..base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def generate_alert_id() -> str:
    return f"ALT-{uuid.uuid4().hex[:6].upper()}"

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("ix_alerts_org_status_severity", "org_id", "status", "severity"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_alert_id, index=True)
    org_id: Mapped[str] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True, default="org_default")
    agent_id: Mapped[str] = mapped_column(String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    first_action_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("actions.id", ondelete="SET NULL"), nullable=True, index=True)
    rule_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("rules.id", ondelete="SET NULL"), nullable=True, index=True)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Security Violation Detected")
    severity: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)  # open, acknowledged, resolved, false_positive
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    group_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True, default=generate_uuid)
    count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    assignee_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __init__(self, **kwargs):
        if "alert_id" in kwargs:
            kwargs.setdefault("id", kwargs.pop("alert_id"))
        if "action_id" in kwargs:
            kwargs.setdefault("first_action_id", kwargs.pop("action_id"))
        if "notes" in kwargs:
            kwargs.setdefault("resolution_note", kwargs.pop("notes"))
        if "created_at" in kwargs:
            kwargs.setdefault("first_seen", kwargs.pop("created_at"))
        if "trigger_type" in kwargs:
            kwargs.pop("trigger_type")
        if "title" not in kwargs:
            kwargs["title"] = f"Security Violation: {kwargs.get('severity', 'Warning')}"
        super().__init__(**kwargs)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="alerts")
    agent: Mapped["Agent"] = relationship("Agent", back_populates="alerts")
    action: Mapped[Optional["Action"]] = relationship("Action", back_populates="alerts")
    comments: Mapped[List["AlertComment"]] = relationship("AlertComment", back_populates="alert", cascade="all, delete-orphan")

    # Synonyms for backward compatibility
    alert_id = synonym("id")
    action_id = synonym("first_action_id")
    created_at = synonym("first_seen")

    @property
    def trigger_type(self) -> str:
        return "rule_match" if self.rule_id else "anomaly"

    @trigger_type.setter
    def trigger_type(self, val: str):
        pass

    @property
    def notes(self) -> Optional[str]:
        return self.resolution_note

    @notes.setter
    def notes(self, val: Optional[str]):
        self.resolution_note = val

class AlertComment(Base):
    __tablename__ = "alert_comments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid, index=True)
    alert_id: Mapped[str] = mapped_column(String(64), ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    alert: Mapped["Alert"] = relationship("Alert", back_populates="comments")
    user: Mapped["User"] = relationship("User", back_populates="alert_comments")
