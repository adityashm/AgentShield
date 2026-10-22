import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Boolean, Integer, DateTime, Text, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from ..base import Base
from ...core.crypto import encrypt_secret, decrypt_secret

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id: Mapped[str] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True, default="org_default")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    type: Mapped[str] = mapped_column(String(32), default="generic", nullable=False)  # generic, slack, discord, pagerduty
    url_enc: Mapped[str] = mapped_column(Text, nullable=False)
    secret_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    routing_key_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    min_severity: Mapped[str] = mapped_column(String(32), default="high", nullable=False)
    event_types: Mapped[List[str]] = mapped_column(JSON, default=lambda: ["alert.created", "alert.escalated", "alert.resolved"], nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Tracking fields
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="webhook_endpoints")
    deliveries: Mapped[List["WebhookDelivery"]] = relationship("WebhookDelivery", back_populates="endpoint", cascade="all, delete-orphan")

    # Synonyms for backward compatibility
    endpoint_id = synonym("id")
    target_type = synonym("type")

    @property
    def url(self) -> str:
        dec = decrypt_secret(self.url_enc)
        return dec if dec else self.url_enc

    @url.setter
    def url(self, val: str):
        self.url_enc = encrypt_secret(val) if val else ""

    @property
    def secret(self) -> Optional[str]:
        if not self.secret_enc:
            return None
        dec = decrypt_secret(self.secret_enc)
        return dec if dec else self.secret_enc

    @secret.setter
    def secret(self, val: Optional[str]):
        self.secret_enc = encrypt_secret(val) if val else None

    @property
    def has_secret(self) -> bool:
        return bool(self.secret_enc)

class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"
    __table_args__ = (
        Index("ix_webhook_deliveries_status_next", "status", "next_attempt_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id: Mapped[str] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True, default="org_default")
    endpoint_id: Mapped[str] = mapped_column(String(64), ForeignKey("webhook_endpoints.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True, index=True)
    
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)  # pending, sent, failed, dead
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="webhook_deliveries")
    endpoint: Mapped["WebhookEndpoint"] = relationship("WebhookEndpoint", back_populates="deliveries")
