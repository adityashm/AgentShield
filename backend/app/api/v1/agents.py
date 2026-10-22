from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from ...database import get_db
from ...schemas import AgentResponse, ActionResponse
from ...models import Agent, Action

router = APIRouter(prefix="/agents", tags=["agents"])

@router.get("", response_model=List[AgentResponse])
def list_agents(db: Session = Depends(get_db)):
    """List all registered AI agents with current risk scores (SRS FR-18)."""
    agents = db.query(Agent).order_by(Agent.current_risk_score.desc()).all()
    return agents

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
        .filter(Action.agent_id == agent_id)
        .order_by(Action.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        ActionResponse(
            action_id=a.action_id,
            agent_id=a.agent_id,
            action_type=a.action_type,
            parameters=a.parameters,
            timestamp=a.timestamp,
            risk_score=a.risk_score,
            anomaly_score=a.anomaly_score,
            session_id=a.session_id,
        )
        for a in actions
    ]

@router.post("/{agent_id}/isolate")
def isolate_agent(agent_id: str, db: Session = Depends(get_db)):
    """Quarantines and isolates an agent from the network."""
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.status = "suspended"
    db.commit()
    return {"status": "quarantined", "agent_id": agent_id, "state": "suspended"}

@router.post("/{agent_id}/restore")
def restore_agent(agent_id: str, db: Session = Depends(get_db)):
    """Restores a quarantined agent to active status."""
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.status = "active"
    db.commit()
    return {"status": "restored", "agent_id": agent_id, "state": "active"}
