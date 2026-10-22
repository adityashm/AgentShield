from datetime import datetime, timezone
import uuid
import json
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from ..database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Organization(Base):
    __tablename__ = "organizations"

    org_id = Column(String(64), primary_key=True, default=generate_uuid, index=True)
    name = Column(String(128), nullable=False)
    slug = Column(String(64), unique=True, nullable=False, index=True)
    is_synthetic = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    api_keys = relationship("APIKey", back_populates="organization", cascade="all, delete-orphan")
    agents = relationship("Agent", back_populates="organization", cascade="all, delete-orphan")
    webhooks = relationship("WebhookEndpoint", back_populates="organization", cascade="all, delete-orphan")

class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    endpoint_id = Column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id = Column(String(64), ForeignKey("organizations.org_id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    url = Column(String(512), nullable=False)
    secret = Column(String(128), nullable=True)  # Secret for HMAC SHA-256 signature
    target_type = Column(String(32), default="generic")  # generic, slack, discord
    min_severity = Column(String(32), default="High")    # Low, Medium, High, Critical
    events = Column(String(256), default="alert.created")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    last_triggered_at = Column(DateTime, nullable=True)
    failure_count = Column(Integer, default=0)

    organization = relationship("Organization", back_populates="webhooks")

class APIKey(Base):
    __tablename__ = "api_keys"

    key_id = Column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id = Column(String(64), ForeignKey("organizations.org_id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    prefix = Column(String(32), index=True, nullable=False)
    hashed_key = Column(String(64), nullable=False)  # SHA-256 hex digest
    scopes = Column(String(256), default="actions:write,alerts:read")
    created_at = Column(DateTime, default=utc_now)
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    organization = relationship("Organization", back_populates="api_keys")

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None

class Agent(Base):
    __tablename__ = "agents"

    agent_id = Column(String(64), primary_key=True, index=True)
    org_id = Column(String(64), ForeignKey("organizations.org_id"), default="org_default", index=True)
    name = Column(String(128), nullable=False)
    current_risk_score = Column(Float, default=0.0)
    status = Column(String(32), default="active")  # active, suspended, offline
    created_at = Column(DateTime, default=utc_now)
    last_seen = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="agents")
    actions = relationship("Action", back_populates="agent", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="agent", cascade="all, delete-orphan")

class Action(Base):
    __tablename__ = "actions"

    action_id = Column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id = Column(String(64), default="org_default", index=True)
    agent_id = Column(String(64), ForeignKey("agents.agent_id"), nullable=False, index=True)
    action_type = Column(String(64), nullable=False, index=True)
    parameters_json = Column(Text, default="{}")
    timestamp = Column(DateTime, default=utc_now, index=True)
    risk_score = Column(Float, default=0.0)
    anomaly_score = Column(Float, default=0.0)
    session_id = Column(String(64), default=generate_uuid)

    agent = relationship("Agent", back_populates="actions")
    alerts = relationship("Alert", back_populates="action", cascade="all, delete-orphan")

    @property
    def parameters(self) -> dict:
        try:
            return json.loads(self.parameters_json)
        except Exception:
            return {}

class Alert(Base):
    __tablename__ = "alerts"

    alert_id = Column(String(64), primary_key=True, default=lambda: f"ALT-{uuid.uuid4().hex[:6].upper()}", index=True)
    org_id = Column(String(64), default="org_default", index=True)
    action_id = Column(String(64), ForeignKey("actions.action_id"), nullable=False, index=True)
    agent_id = Column(String(64), ForeignKey("agents.agent_id"), nullable=False, index=True)
    trigger_type = Column(String(64), nullable=False)  # rule_match, anomaly, combined
    severity = Column(String(32), nullable=False)      # Critical, High, Medium, Low
    risk_score = Column(Float, nullable=False)
    status = Column(String(32), default="Open")        # Open, Acknowledged, Resolved
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    resolved_at = Column(DateTime, nullable=True)

    agent = relationship("Agent", back_populates="alerts")
    action = relationship("Action", back_populates="alerts")

class Rule(Base):
    __tablename__ = "rules"

    rule_id = Column(String(64), primary_key=True, index=True)
    org_id = Column(String(64), default="org_default", index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(64), nullable=False)     # Access Control, Network, Input Validation, File System, Rate Limiting
    condition_json = Column(Text, nullable=False)
    severity = Column(String(32), nullable=False)     # Critical, High, Medium, Low
    enabled = Column(Boolean, default=True)
    matches_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now)

class AuditLog(Base):
    __tablename__ = "audit_log"

    log_id = Column(String(64), primary_key=True, default=generate_uuid, index=True)
    org_id = Column(String(64), default="org_default", index=True)
    event_type = Column(String(64), nullable=False)
    actor = Column(String(128), default="system")
    details = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
