import uuid
from datetime import datetime, timezone
from typing import Optional, List, Any
from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from ..base import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class APIKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id: Mapped[str] = mapped_column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True, default="org_default")
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    prefix: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    scopes: Mapped[List[str]] = mapped_column(JSON, default=lambda: ["ingest", "evaluate", "read"], nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="api_keys")

    def __init__(self, **kwargs: Any):
        if "created_by_user_id" in kwargs:
            kwargs.setdefault("created_by", kwargs.pop("created_by_user_id"))
        kwargs.pop("is_test", None)
        kwargs.pop("rate_limit_per_minute", None)
        super().__init__(**kwargs)

    # Synonyms for backward compatibility
    key_id = synonym("id")

    @property
    def is_test(self) -> bool:
        return "test" in self.prefix

    @property
    def rate_limit_per_minute(self) -> int:
        return 120

    @property
    def is_active(self) -> bool:
        if self.revoked_at is not None:
            return False
        exp = self.expires_at
        if exp is not None:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                return False
        return True

    @property
    def hashed_key(self) -> str:
        return self.key_hash

    @hashed_key.setter
    def hashed_key(self, val: str):
        self.key_hash = val
