"""
backend/app/api/v1/playbooks.py — Incident Response Playbook Management API.
Supports viewing, creating, and toggling automated remediation playbooks.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from ...database import get_db
from ...db.models import Playbook, Organization
from ...core.deps import get_current_org_from_key

router = APIRouter(prefix="/playbooks", tags=["Incident Response Playbooks"])

class PlaybookCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_event: str = "alert.created"
    severity_threshold: str = "Critical"
    count_threshold: int = Field(default=2, ge=1)
    time_window_seconds: int = Field(default=300, ge=10)
    action_type: str = "quarantine_agent"  # quarantine_agent, trip_circuit_breaker
    enabled: bool = True

class PlaybookResponse(BaseModel):
    id: str
    org_id: str
    name: str
    description: Optional[str]
    trigger_event: str
    severity_threshold: str
    count_threshold: int
    time_window_seconds: int
    action_type: str
    enabled: bool
    execution_count: int
    last_triggered_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

@router.get("", response_model=List[PlaybookResponse])
def list_playbooks(
    request: Request,
    db: Session = Depends(get_db),
    auth_context: tuple[Organization, Any] = Depends(get_current_org_from_key),
):
    """Lists all automated remediation playbooks configured for the organization."""
    org, _ = auth_context
    playbooks = db.query(Playbook).filter(Playbook.org_id == org.id).order_by(Playbook.created_at.desc()).all()
    # Fallback to defaults
    if not playbooks and org.id == "org_default":
        from ...services.playbook_engine import PlaybookEngine
        PlaybookEngine.seed_default_playbooks(db, org_id="org_default")
        playbooks = db.query(Playbook).filter(Playbook.org_id == org.id).all()
        
    return [
        PlaybookResponse(
            id=p.id,
            org_id=p.org_id,
            name=p.name,
            description=p.description,
            trigger_event=p.trigger_event,
            severity_threshold=p.severity_threshold,
            count_threshold=p.count_threshold,
            time_window_seconds=p.time_window_seconds,
            action_type=p.action_type,
            enabled=p.enabled,
            execution_count=p.execution_count or 0,
            last_triggered_at=p.last_triggered_at.isoformat() if p.last_triggered_at else None,
        )
        for p in playbooks
    ]

@router.post("", response_model=PlaybookResponse)
def create_playbook(
    body: PlaybookCreateRequest,
    db: Session = Depends(get_db),
    auth_context: tuple[Organization, Any] = Depends(get_current_org_from_key),
):
    """Creates a new automated incident response playbook."""
    org, _ = auth_context
    pb = Playbook(
        org_id=org.id,
        name=body.name,
        description=body.description,
        trigger_event=body.trigger_event,
        severity_threshold=body.severity_threshold,
        count_threshold=body.count_threshold,
        time_window_seconds=body.time_window_seconds,
        action_type=body.action_type,
        enabled=body.enabled,
    )
    db.add(pb)
    db.commit()
    db.refresh(pb)
    return PlaybookResponse(
        id=pb.id,
        org_id=pb.org_id,
        name=pb.name,
        description=pb.description,
        trigger_event=pb.trigger_event,
        severity_threshold=pb.severity_threshold,
        count_threshold=pb.count_threshold,
        time_window_seconds=pb.time_window_seconds,
        action_type=pb.action_type,
        enabled=pb.enabled,
        execution_count=0,
        last_triggered_at=None,
    )

@router.patch("/{playbook_id}/toggle")
def toggle_playbook(
    playbook_id: str,
    db: Session = Depends(get_db),
    auth_context: tuple[Organization, Any] = Depends(get_current_org_from_key),
):
    """Toggles a playbook active or disabled."""
    org, _ = auth_context
    pb = db.query(Playbook).filter(Playbook.id == playbook_id, Playbook.org_id == org.id).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    pb.enabled = not pb.enabled
    db.commit()
    return {"id": pb.id, "enabled": pb.enabled}

@router.delete("/{playbook_id}")
def delete_playbook(
    playbook_id: str,
    db: Session = Depends(get_db),
    auth_context: tuple[Organization, Any] = Depends(get_current_org_from_key),
):
    """Deletes an automated incident response playbook."""
    org, _ = auth_context
    pb = db.query(Playbook).filter(Playbook.id == playbook_id, Playbook.org_id == org.id).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    db.delete(pb)
    db.commit()
    return {"status": "deleted", "id": playbook_id}
