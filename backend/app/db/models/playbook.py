"""
backend/app/db/models/playbook.py — Automated Incident Remediation Playbooks.
Defines automated playbooks triggered by security events (e.g. auto-quarantine, circuit-breakers).
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Boolean, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from ..base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Playbook(Base):
    __tablename__ = "playbooks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id: Mapped[str] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True, default="org_default")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    trigger_event: Mapped[str] = mapped_column(String(64), default="alert.created", nullable=False)
    severity_threshold: Mapped[str] = mapped_column(String(32), default="Critical", nullable=False)
    count_threshold: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    time_window_seconds: Mapped[int] = mapped_column(Integer, default=300, nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), default="quarantine_agent", nullable=False)  # quarantine_agent, trip_circuit_breaker, notify
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    execution_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization: Mapped["Organization"] = relationship("Organization")

    # Synonyms for backward compatibility
    is_active = synonym("enabled")
    playbook_id = synonym("id")
