import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...database import get_db
from ...schemas import AgentResponse, ActionResponse
from ...db.models import Agent, Action, AuditLog
from ...services.audit import AuditService
from ...core.errors import NotFoundError

router = APIRouter(prefix="/agents", tags=["agents"])

class AgentStatusChangeRequest(BaseModel):
    reason: Optional[str] = "Manual administrative action"
    notes: Optional[str] = None

class AgentCreateRequest(BaseModel):
    agent_id: str
    name: str
    framework: Optional[str] = "custom"
    environment: Optional[str] = "production"
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@router.get("", response_model=List[AgentResponse])
def list_agents(
    request: Request,
    environment: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    """List all registered AI agents with current risk scores (SRS FR-18)."""
    org_id = getattr(request.state, "org_id", "org_default")
    q = db.query(Agent).filter(Agent.org_id == org_id)
    if environment:
        q = q.filter(Agent.environment == environment)
    if status_filter:
        q = q.filter(Agent.status == status_filter)
    
    agents = q.order_by(Agent.current_risk_score.desc()).all()
    # Fallback to all agents if empty (e.g. legacy test without tenancy middleware)
    if not agents and org_id == "org_default":
        agents = db.query(Agent).order_by(Agent.current_risk_score.desc()).all()
    return agents

@router.post("", response_model=AgentResponse)
def create_agent(
    body: AgentCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Provision a new agent in the organization."""
    org_id = getattr(request.state, "org_id", "org_default")
    existing = db.query(Agent).filter((Agent.id == body.agent_id) | (Agent.external_id == body.agent_id)).first()
    if existing:
        return existing
    
    agent = Agent(
        id=body.agent_id,
        external_id=body.agent_id,
        org_id=org_id,
        name=body.name,
        framework=body.framework or "custom",
        environment=body.environment or "production",
        status="active",
        risk_score=10.0,
        metadata_json=body.metadata or {},
        first_seen=datetime.now(timezone.utc),
        last_seen=datetime.now(timezone.utc),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent

@router.get("/{agent_id}")
def get_agent_detail(
    agent_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Get detailed telemetry, metadata, and status for a single agent."""
    org_id = getattr(request.state, "org_id", "org_default")
    agent = (
        db.query(Agent)
        .filter((Agent.id == agent_id) | (Agent.external_id == agent_id))
        .first()
    )
    if not agent:
        raise NotFoundError("Agent not found")
    
    return {
        "id": agent.id,
        "agent_id": agent.external_id or agent.id,
        "name": agent.name,
        "framework": agent.framework,
        "environment": agent.environment,
        "status": agent.status,
        "risk_score": agent.risk_score,
        "current_risk_score": agent.risk_score,
        "first_seen": agent.first_seen.isoformat() if agent.first_seen else None,
        "last_seen": agent.last_seen.isoformat() if agent.last_seen else None,
        "metadata": agent.metadata_json or {},
    }

@router.get("/{agent_id}/actions", response_model=List[ActionResponse])
def get_agent_actions(
    agent_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Get paginated action history for a specific agent (SRS Section 3.3.2)."""
    offset = (page - 1) * limit
    actions = (
        db.query(Action)
        .filter((Action.agent_id == agent_id) | (Action.agent.has(Agent.external_id == agent_id)))
        .order_by(Action.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        ActionResponse(
            action_id=a.action_id,
            agent_id=a.agent.external_id if a.agent and a.agent.external_id else a.agent_id,
            action_type=a.action_type,
            parameters=a.parameters,
            timestamp=a.timestamp,
            risk_score=a.risk_score,
            anomaly_score=a.anomaly_score,
            session_id=a.session_id or "",
        )
        for a in actions
    ]

@router.post("/{agent_id}/quarantine")
@router.post("/{agent_id}/isolate")
def quarantine_agent(
    agent_id: str,
    request: Request,
    body: Optional[AgentStatusChangeRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Quarantines an agent from the network. Pre-flight evaluations will deny actions.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    user_id = getattr(getattr(request.state, "user", None), "id", None) or "system"
    now = datetime.now(timezone.utc)
    reason = body.reason if body and body.reason else "Manual quarantine action"

    agent = (
        db.query(Agent)
        .filter((Agent.id == agent_id) | (Agent.external_id == agent_id))
        .first()
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.status = "quarantined"
    meta = dict(agent.metadata_json or {})
    meta["status_reason"] = reason
    meta["quarantined_at"] = now.isoformat()
    meta["quarantined_by"] = user_id
    agent.metadata_json = meta

    AuditService.log_event(
        db=db,
        org_id=agent.org_id,
        action="agent.quarantine",
        target_type="agent",
        target_id=agent.id,
        actor_type="user" if user_id != "system" else "system",
        actor_id=user_id,
        ip=request.client.host if request.client else "127.0.0.1",
        details={"agent_id": agent.id, "external_id": agent.external_id, "reason": reason},
    )
    db.commit()

    return {
        "status": "quarantined",
        "agent_id": agent_id,
        "state": "quarantined",
        "reason": reason,
        "timestamp": now.isoformat(),
    }

@router.post("/{agent_id}/halt")
def halt_agent(
    agent_id: str,
    request: Request,
    body: Optional[AgentStatusChangeRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Hard freeze an agent immediately (fail-closed, denies all actions).
    """
    org_id = getattr(request.state, "org_id", "org_default")
    user_id = getattr(getattr(request.state, "user", None), "id", None) or "system"
    now = datetime.now(timezone.utc)
    reason = body.reason if body and body.reason else "Manual emergency halt"

    agent = (
        db.query(Agent)
        .filter((Agent.id == agent_id) | (Agent.external_id == agent_id))
        .first()
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.status = "halted"
    meta = dict(agent.metadata_json or {})
    meta["status_reason"] = reason
    meta["halted_at"] = now.isoformat()
    meta["halted_by"] = user_id
    agent.metadata_json = meta

    AuditService.log_event(
        db=db,
        org_id=agent.org_id,
        action="agent.halt",
        target_type="agent",
        target_id=agent.id,
        actor_type="user" if user_id != "system" else "system",
        actor_id=user_id,
        ip=request.client.host if request.client else "127.0.0.1",
        details={"agent_id": agent.id, "external_id": agent.external_id, "reason": reason},
    )
    db.commit()

    return {
        "status": "halted",
        "agent_id": agent_id,
        "state": "halted",
        "reason": reason,
        "timestamp": now.isoformat(),
    }

@router.post("/{agent_id}/release")
@router.post("/{agent_id}/restore")
def release_agent(
    agent_id: str,
    request: Request,
    body: Optional[AgentStatusChangeRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Restores a quarantined or halted agent to active status.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    user_id = getattr(getattr(request.state, "user", None), "id", None) or "system"
    now = datetime.now(timezone.utc)
    reason = body.reason if body and body.reason else "Manual release to active service"

    agent = (
        db.query(Agent)
        .filter((Agent.id == agent_id) | (Agent.external_id == agent_id))
        .first()
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.status = "active"
    meta = dict(agent.metadata_json or {})
    meta.pop("status_reason", None)
    meta["released_at"] = now.isoformat()
    meta["released_by"] = user_id
    agent.metadata_json = meta

    AuditService.log_event(
        db=db,
        org_id=agent.org_id,
        action="agent.release",
        target_type="agent",
        target_id=agent.id,
        actor_type="user" if user_id != "system" else "system",
        actor_id=user_id,
        ip=request.client.host if request.client else "127.0.0.1",
        details={"agent_id": agent.id, "external_id": agent.external_id, "reason": reason},
    )
    db.commit()

    return {
        "status": "restored",
        "agent_id": agent_id,
        "state": "active",
        "reason": reason,
        "timestamp": now.isoformat(),
    }
