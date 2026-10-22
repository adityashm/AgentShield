import uuid
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import String, Boolean, Integer, DateTime, Text, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from ..base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Rule(Base):
    __tablename__ = "rules"
    __table_args__ = (
        Index("ix_rules_org_enabled", "org_id", "enabled"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True, default="org_default")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)
    mode: Mapped[str] = mapped_column(String(32), default="alert", nullable=False)  # monitor, alert, block
    condition: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    owasp_ids: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    atlas_ids: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cloned_from: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    matches_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization: Mapped[Optional["Organization"]] = relationship("Organization", back_populates="rules")

    # Synonym for backward compatibility
    rule_id = synonym("id")

    @property
    def category(self) -> str:
        return self.condition.get("category", "General") if isinstance(self.condition, dict) else "General"

    @category.setter
    def category(self, val: str):
        if not isinstance(self.condition, dict):
            self.condition = {}
        self.condition["category"] = val

    @property
    def condition_json(self) -> str:
        return json.dumps(self.condition or {})

    @condition_json.setter
    def condition_json(self, val: str):
        try:
            self.condition = json.loads(val) if val else {}
        except Exception:
            self.condition = {}
