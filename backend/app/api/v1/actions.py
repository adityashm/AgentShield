from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import json
import uuid
import asyncio

from ...database import get_db
from ...schemas import ActionCreate, ActionBulkCreate, ActionResponse
from ...models import Action, Agent, Alert, Organization
from ...services.rule_engine import RuleEngine
from ...services.ml_engine import ml_engine
from ...services.risk_calculator import RiskCalculator
from ...services.websocket_manager import ws_manager
from ...services.webhook_dispatcher import webhook_dispatcher
from ...services.auth import get_current_org
from ...config import settings

router = APIRouter(prefix="/actions", tags=["actions"])

class EvaluateRequest(BaseModel):
    agent_id: str
    action_type: str
    parameters: Dict[str, Any] = {}

class EvaluateResponse(BaseModel):
    decision: str  # allow, deny, review
    risk_score: float
    anomaly_score: float
    violated_rules: List[str]
    reason: Optional[str] = None

@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_action_preflight(
    eval_in: EvaluateRequest,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db),
):
    """
    Synchronous pre-action evaluation endpoint for AgentShield SDK 'enforce' mode.
    Returns allow, deny, or review before the agent executes the tool.
    """
    # 1. Rule Engine evaluation
    eval_payload = {"action_type": eval_in.action_type, "parameters": eval_in.parameters}
    matched_rules, rule_severity_score = RuleEngine.evaluate_action(eval_payload, db)

    # 2. ML Engine evaluation
    anomaly_score = ml_engine.predict_anomaly_score({
        "action_type": eval_in.action_type,
        "parameters": eval_in.parameters,
        "call_frequency": 30.0 if matched_rules else 15.0,
        "session_duration": 180.0,
    })

    if rule_severity_score >= 75.0:
        anomaly_score = max(anomaly_score, 0.85)

    # 3. Risk calculation
    risk_score = RiskCalculator.calculate_action_risk(rule_severity_score, anomaly_score)

    violated_rule_ids = [r.rule_id for r in matched_rules]

    if risk_score >= settings.ALERT_RISK_THRESHOLD:
        decision = "deny"
        reason = f"Violated policy {violated_rule_ids[0]}" if violated_rule_ids else "Exceeded anomaly safety threshold"
    elif risk_score >= 50.0:
        decision = "review"
        reason = "Medium risk activity detected; flagging for analyst review"
    else:
        decision = "allow"
        reason = None

    return EvaluateResponse(
        decision=decision,
        risk_score=risk_score,
        anomaly_score=anomaly_score,
        violated_rules=violated_rule_ids,
        reason=reason,
    )

@router.post("", response_model=ActionResponse)
async def ingest_action(
    action_in: ActionCreate,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db),
):
    """Ingest a single agent action event (SRS FR-01) scoped by organization."""
    now = action_in.timestamp or datetime.now(timezone.utc)
    time_str = now.strftime("%H:%M:%S.%f")[:12]

    # Ensure agent exists under this organization
    agent = (
        db.query(Agent)
        .filter(Agent.agent_id == action_in.agent_id, Agent.org_id == org.org_id)
        .first()
    )
    if not agent:
        agent = Agent(
            agent_id=action_in.agent_id,
            org_id=org.org_id,
            name=f"Agent {action_in.agent_id}",
            current_risk_score=0.0,
            status="active",
        )
        db.add(agent)
        db.commit()

    # If agent is suspended, reject with 403
    if agent.status == "suspended":
        raise HTTPException(
            status_code=403,
            detail=f"Agent {action_in.agent_id} is quarantined and suspended from network.",
        )

    # 1. Rule Engine evaluation
    eval_payload = {"action_type": action_in.action_type, "parameters": action_in.parameters}
    matched_rules, rule_severity_score = RuleEngine.evaluate_action(eval_payload, db)

    # 2. ML Engine evaluation
    anomaly_score = ml_engine.predict_anomaly_score({
        "action_type": action_in.action_type,
        "parameters": action_in.parameters,
        "call_frequency": 30.0 if matched_rules else 15.0,
        "session_duration": 180.0,
    })

    if rule_severity_score >= 75.0:
        anomaly_score = max(anomaly_score, 0.85)

    # 3. Risk calculation
    risk_score = RiskCalculator.calculate_action_risk(rule_severity_score, anomaly_score)

    # 4. Save action
    action_id = str(uuid.uuid4())
    session_id = action_in.session_id or str(uuid.uuid4())
    action = Action(
        action_id=action_id,
        org_id=org.org_id,
        agent_id=action_in.agent_id,
        action_type=action_in.action_type,
        parameters_json=json.dumps(action_in.parameters),
        timestamp=now,
        risk_score=risk_score,
        anomaly_score=anomaly_score,
        session_id=session_id,
    )
    db.add(action)

    # Update rolling risk
    RiskCalculator.update_agent_rolling_risk(action_in.agent_id, db)

    # 5. Alert generation if risk threshold exceeded
    alert_info = None
    if risk_score >= settings.ALERT_RISK_THRESHOLD:
        severity = "Critical" if risk_score >= 80 else "High"
        trigger_type = "rule_match" if matched_rules else "anomaly"
        alert_id = f"ALT-{uuid.uuid4().hex[:6].upper()}"
        alert = Alert(
            alert_id=alert_id,
            org_id=org.org_id,
            action_id=action_id,
            agent_id=action_in.agent_id,
            trigger_type=trigger_type,
            severity=severity,
            risk_score=risk_score,
            status="Open",
            notes=f"Triggered by {matched_rules[0].name if matched_rules else 'Isolation Forest ML Anomaly'}",
            created_at=now,
        )
        db.add(alert)
        alert_info = {
            "alert_id": alert_id,
            "agent_id": action_in.agent_id,
            "severity": severity,
            "risk_score": risk_score,
        }

    db.commit()
    db.refresh(action)

    # 6. Dispatch Webhook notifications asynchronously if alert was triggered
    if alert_info:
        asyncio.create_task(
            webhook_dispatcher.dispatch_alert_async(
                org_id=org.org_id,
                alert_data={
                    "alert_id": alert.alert_id,
                    "agent_id": alert.agent_id,
                    "severity": alert.severity,
                    "risk_score": alert.risk_score,
                    "trigger_type": alert.trigger_type,
                    "notes": alert.notes,
                    "created_at": alert.created_at.isoformat() if alert.created_at else now.isoformat(),
                },
                action_data={
                    "action_id": action_id,
                    "action_type": action_in.action_type,
                    "parameters": action_in.parameters,
                },
            )
        )

    # Broadcast over WebSocket
    ws_event = {
        "type": "ACTION_EVENT",
        "org_id": org.org_id,
        "action_id": action_id,
        "agent": action_in.agent_id,
        "action": action_in.action_type,
        "risk": risk_score,
        "anomaly": anomaly_score,
        "tone": "danger" if risk_score >= 75 else "warning" if risk_score >= 45 else "success",
        "time": time_str,
        "status": "Critical" if risk_score >= 80 else "Suspicious" if risk_score >= 50 else "Normal",
        "alert": alert_info,
    }
    await ws_manager.broadcast_agent_event(action_in.agent_id, ws_event)

    return ActionResponse(
        action_id=action.action_id,
        agent_id=action.agent_id,
        action_type=action.action_type,
        parameters=action.parameters,
        timestamp=action.timestamp,
        risk_score=action.risk_score,
        anomaly_score=action.anomaly_score,
        session_id=action.session_id,
    )

@router.post("/bulk")
async def bulk_ingest(
    bulk_in: ActionBulkCreate,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db),
):
    """Bulk ingest actions from CSV/JSON import scoped by organization."""
    count = 0
    for act in bulk_in.actions:
        await ingest_action(act, org, db)
        count += 1
    return {"status": "success", "ingested_count": count}
