"""
agentshield.models — Data models and type schemas for AgentShield SDK.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, ConfigDict


def generate_event_id() -> str:
    return f"evt_{uuid.uuid4().hex}"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ActionPayload(BaseModel):
    event_id: str = Field(default_factory=generate_event_id)
    agent_id: str
    session_id: Optional[str] = None
    action_type: str = "tool_call"
    tool_name: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    output_excerpt: Optional[str] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=utc_now)

    model_config = ConfigDict(from_attributes=True)

    def to_dict(self) -> Dict[str, Any]:
        data = self.model_dump()
        data["timestamp"] = self.timestamp.isoformat()
        return data


class EvaluationResult(BaseModel):
    decision: str = "allow"  # allow, review, deny
    risk_score: float = 0.0
    anomaly_score: float = 0.0
    violated_rules: List[str] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)
    agent_status: str = "active"  # active, quarantined, halted
    latency_ms: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

    @property
    def is_allowed(self) -> bool:
        return self.decision == "allow"

    @property
    def is_denied(self) -> bool:
        return self.decision == "deny"


class PingResponse(BaseModel):
    status: str
    organization: Optional[str] = None
    scopes: List[str] = Field(default_factory=list)
    key_prefix: Optional[str] = None
