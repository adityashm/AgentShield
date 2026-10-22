from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from ...database import get_db
from ...schemas import AlertResponse, AlertUpdate
from ...models import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[AlertResponse])
def list_alerts(
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List alerts with optional filters (severity, status, agent) (SRS Section 3.3.2)."""
    q = db.query(Alert)
    if severity and severity.lower() != "all":
        q = q.filter(Alert.severity.ilike(severity))
    if status and status.lower() != "all":
        q = q.filter(Alert.status.ilike(status))
    if agent_id:
        q = q.filter(Alert.agent_id == agent_id)
    return q.order_by(Alert.created_at.desc()).limit(limit).all()

@router.get("/{alert_id}")
def get_alert_detail(alert_id: str, db: Session = Depends(get_db)):
    """Retrieve complete alert information with triggering action payload."""
    alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    action = alert.action
    return {
        "alert": AlertResponse.from_orm(alert),
        "action": {
            "action_id": action.action_id if action else None,
            "action_type": action.action_type if action else None,
            "parameters": action.parameters if action else {},
            "timestamp": action.timestamp if action else None,
            "risk_score": action.risk_score if action else None,
            "anomaly_score": action.anomaly_score if action else None,
        } if action else None,
    }

@router.patch("/{alert_id}", response_model=AlertResponse)
def update_alert(alert_id: str, update_in: AlertUpdate, db: Session = Depends(get_db)):
    """Update alert status (Acknowledge / Resolve) with notes (SRS FR-23)."""
    alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = update_in.status
    if update_in.notes:
        alert.notes = update_in.notes
    if update_in.status == "Resolved":
        alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)
    return alert
