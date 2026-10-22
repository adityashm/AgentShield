from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime

class ActionCreate(BaseModel):
    agent_id: str
    action_type: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None
    timestamp: Optional[datetime] = None

class ActionBulkCreate(BaseModel):
    actions: List[ActionCreate]

class ActionResponse(BaseModel):
    action_id: str
    agent_id: str
    action_type: str
    parameters: Dict[str, Any]
    timestamp: datetime
    risk_score: float
    anomaly_score: float
    session_id: str

    model_config = ConfigDict(from_attributes=True)

class AlertResponse(BaseModel):
    alert_id: str
    action_id: str
    agent_id: str
    trigger_type: str
    severity: str
    risk_score: float
    status: str
    notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AlertUpdate(BaseModel):
    status: str  # Open, Acknowledged, Resolved
    notes: Optional[str] = None

class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    severity: str
    condition_json: str
    enabled: bool = True

class RuleResponse(BaseModel):
    rule_id: str
    name: str
    description: Optional[str]
    category: str
    severity: str
    condition_json: str
    enabled: bool
    matches_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AgentResponse(BaseModel):
    agent_id: str
    name: str
    current_risk_score: float
    status: str
    created_at: datetime
    last_seen: datetime

    model_config = ConfigDict(from_attributes=True)

class SystemHealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    active_agents_count: int
    total_actions_today: int
    open_alerts_count: int
    isolation_forest_ready: bool
    database_connected: bool
    nodes: List[Dict[str, Any]]
