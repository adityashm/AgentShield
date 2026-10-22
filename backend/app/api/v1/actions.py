import json
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...database import get_db
from ...db.models import Action, Agent, Alert, Organization, APIKey, SessionModel
from ...services.rule_engine import RuleEngine
from ...services.ml_engine import ml_engine
from ...services.risk_calculator import RiskCalculator
from ...services.websocket_manager import ws_manager
from ...services.webhook_dispatcher import webhook_dispatcher
from ...core.config import settings
from ...core.deps import get_current_org_from_key
from ...core.ratelimit import api_key_limiter
from ...core.errors import RateLimitExceededError, ForbiddenError, ProblemException

router = APIRouter(tags=["Actions & Ingestion"])

# ==============================================================================
# Request & Response Schemas
# ==============================================================================

class ActionEvent(BaseModel):
    event_id: Optional[str] = None
    agent_id: str
    agent_name: Optional[str] = None
    framework: Optional[str] = None
    environment: Optional[str] = "production"
    session_id: Optional[str] = None
    trace_id: Optional[str] = None
    parent_event_id: Optional[str] = None
    action_type: str
    tool_name: Optional[str] = None
    status: Optional[str] = "started"
    parameters: Dict[str, Any] = Field(default_factory=dict)
    output: Optional[Union[str, Dict[str, Any]]] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    timestamp: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

class BatchIngestRequest(BaseModel):
    events: List[ActionEvent]

class LegacyBulkCreate(BaseModel):
    actions: List[ActionEvent]

class MatchedRuleInfo(BaseModel):
    id: str
    name: str
    severity: str

class EventResult(BaseModel):
    event_id: str
    risk_score: float
    severity: str
    decision: str
    matched_rules: List[MatchedRuleInfo]

class BatchIngestResponse(BaseModel):
    accepted: int
    duplicates: int
    agent_status: str
    results: List[EventResult]

class EvaluateRequest(BaseModel):
    agent_id: str
    action_type: str
    tool_name: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None
    persist: Optional[bool] = True

class EvaluateResponse(BaseModel):
    decision: str  # allow, deny, review
    risk_score: float
    severity: str
    reasons: List[str]
    matched_rules: List[Dict[str, Any]]
    agent_status: str
    evaluation_id: str
    persisted: bool
    # Backward compatibility fields
    violated_rules: List[str] = Field(default_factory=list)
    anomaly_score: float = 0.0

def sanitize_payload(obj: Any, depth: int = 0) -> Any:
    """Limits parameter recursion depth to 10 and truncates strings at 64 KB."""
    if depth > 10:
        return "[MAX_DEPTH_EXCEEDED]"
    if isinstance(obj, dict):
        return {str(k): sanitize_payload(v, depth + 1) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_payload(x, depth + 1) for x in obj]
    if isinstance(obj, str) and len(obj) > 65536:
        return obj[:65536] + " [truncated:true]"
    return obj

def check_key_limits(key_record: APIKey, required_scope: str):
    """Enforces rate limiting and scope checks on the authenticated API key."""
    # 1. Scope check
    key_scopes = key_record.scopes if isinstance(key_record.scopes, list) else []
    scope_aliases = {
        "ingest": ["ingest", "actions:write", "write", "all", "admin"],
        "evaluate": ["evaluate", "actions:write", "write", "all", "admin"],
        "read": ["read", "alerts:read", "actions:read", "all", "admin"],
    }
    allowed_aliases = scope_aliases.get(required_scope, [required_scope, "all", "admin"])
    if not any(s in key_scopes for s in allowed_aliases):
        raise ForbiddenError(f"API key missing required scope: '{required_scope}'.")

    # 2. Rate limit check (sliding window per key)
    allowed, retry_after = api_key_limiter.is_allowed(
        key=key_record.id,
        max_requests=settings.RATE_LIMIT_PER_KEY_PER_MIN,
        window_seconds=60,
    )
    if not allowed:
        raise RateLimitExceededError(
            detail=f"Rate limit of {settings.RATE_LIMIT_PER_KEY_PER_MIN} req/min exceeded.",
            retry_after=retry_after,
        )

# ==============================================================================
# Core Action Evaluation & Processing
# ==============================================================================

def process_single_action(
    event: ActionEvent,
    org: Organization,
    db: Session,
    persist: bool = True,
) -> tuple[Action, List[MatchedRuleInfo], str]:
    now = datetime.now(timezone.utc)
    
    # Clock skew handling within +/- 24 hours
    clock_skew = False
    event_ts = event.timestamp
    if event_ts:
        if event_ts.tzinfo is None:
            event_ts = event_ts.replace(tzinfo=timezone.utc)
        skew_hours = abs((now - event_ts).total_seconds()) / 3600.0
        if skew_hours > 24.0:
            clock_skew = True
            event_ts = now
    else:
        event_ts = now

    event_id = event.event_id or str(uuid.uuid4())
    sanitized_params = sanitize_payload(event.parameters)

    # 1. Agent auto-registration and status lookup
    agent = (
        db.query(Agent)
        .filter(Agent.external_id == event.agent_id, Agent.org_id == org.id)
        .first()
    )
    if not agent:
        existing_pk = db.query(Agent).filter(Agent.id == event.agent_id).first()
        agent_pk = event.agent_id if not existing_pk else f"{org.id}_{event.agent_id}"
        agent = Agent(
            id=agent_pk,
            org_id=org.id,
            external_id=event.agent_id,
            name=event.agent_name or f"Agent {event.agent_id}",
            framework=event.framework,
            environment=event.environment or "production",
            status="active",
            risk_score=0.0,
            first_seen=now,
            last_seen=now,
            metadata_json=event.metadata or {},
        )
        db.add(agent)
        db.flush()
    else:
        agent.last_seen = now
        if event.agent_name and agent.name != event.agent_name:
            agent.name = event.agent_name

    # 2. Session tracking
    session_pk = None
    if event.session_id:
        sess = (
            db.query(SessionModel)
            .filter(
                SessionModel.org_id == org.id,
                SessionModel.agent_id == agent.id,
                SessionModel.external_session_id == event.session_id,
            )
            .first()
        )
        if not sess:
            sess = SessionModel(
                id=str(uuid.uuid4()),
                org_id=org.id,
                agent_id=agent.id,
                external_session_id=event.session_id,
                started_at=now,
                last_event_at=now,
                event_count=1,
            )
            db.add(sess)
            db.flush()
        else:
            sess.last_event_at = now
            sess.event_count = (sess.event_count or 0) + 1
        session_pk = sess.id

    # 3. Rule evaluation
    eval_payload = {
        "action_type": event.action_type,
        "tool_name": event.tool_name,
        "parameters": sanitized_params,
        "output": event.output,
    }
    matched_rules, rule_severity_score = RuleEngine.evaluate_action(eval_payload, db)

    # 4. ML Anomaly evaluation
    anomaly_score = ml_engine.predict_anomaly_score({
        "action_type": event.action_type,
        "parameters": sanitized_params,
        "call_frequency": 30.0 if matched_rules else 15.0,
        "session_duration": 180.0,
    })
    if rule_severity_score >= 75.0:
        anomaly_score = max(anomaly_score, 0.85)

    # 5. Risk score & decision calculation
    risk_score = RiskCalculator.calculate_action_risk(rule_severity_score, anomaly_score)

    # Quarantine / Halt enforcement logic
    if agent.status == "quarantined":
        decision = "deny"
        reason = "agent_quarantined"
        severity = "high"
    elif agent.status == "halted":
        decision = "deny"
        reason = "agent_halted"
        severity = "critical"
    elif any(getattr(r, "mode", "alert") == "block" or getattr(r, "severity", "medium").lower() in ("critical", "high") for r in matched_rules) or risk_score >= settings.BLOCK_THRESHOLD:
        decision = "deny"
        risk_score = max(risk_score, 90.0)
        severity = "critical" if (matched_rules and getattr(matched_rules[0], "severity", "").lower() == "critical") else "high"
        reason = f"Blocked by guardrail policy: {matched_rules[0].name}" if matched_rules else "High risk threshold exceeded"
    elif risk_score >= settings.REVIEW_THRESHOLD:
        decision = "review"
        severity = "high"
        reason = "High anomaly activity requiring analyst review"
    elif risk_score >= settings.ALERT_THRESHOLD:
        decision = "allow"
        severity = "medium"
        reason = "Elevated risk score observed"
    else:
        decision = "allow"
        severity = "low"
        reason = None

    matched_rule_models = [
        MatchedRuleInfo(
            id=r.id,
            name=r.name,
            severity=r.severity,
        )
        for r in matched_rules
    ]

    action = Action(
        id=str(uuid.uuid4()),
        org_id=org.id,
        agent_id=agent.id,
        session_id=session_pk,
        event_id=event_id,
        parent_event_id=event.parent_event_id,
        trace_id=event.trace_id,
        action_type=event.action_type,
        tool_name=event.tool_name,
        status=event.status or "started",
        parameters=sanitized_params,
        output_excerpt=str(event.output)[:2048] if event.output else None,
        latency_ms=event.latency_ms,
        error=event.error,
        timestamp=event_ts,
        received_at=now,
        clock_skew=clock_skew,
        features={"anomaly_score": anomaly_score, "rule_score": rule_severity_score},
        rule_score=rule_severity_score,
        anomaly_score=anomaly_score,
        risk_score=risk_score,
        severity=severity,
        decision=decision,
        reason=reason,
        matched_rules=[{"id": r.id, "name": r.name, "severity": r.severity} for r in matched_rules],
    )

    if persist:
        db.add(action)
        RiskCalculator.update_agent_rolling_risk(agent.id, db)

        # Alert creation if threshold exceeded
        if risk_score >= settings.ALERT_THRESHOLD or matched_rules:
            alert_id = f"ALT-{uuid.uuid4().hex[:6].upper()}"
            alert = Alert(
                id=alert_id,
                org_id=org.id,
                agent_id=agent.id,
                first_action_id=action.id,
                rule_id=matched_rules[0].id if matched_rules else None,
                title=f"Security Alert: {matched_rules[0].name if matched_rules else 'Behavioural Anomaly'}",
                severity="Critical" if risk_score >= 80 else "High" if risk_score >= 60 else "Medium",
                risk_score=risk_score,
                status="Open",
                group_key=f"{agent.id}:{matched_rules[0].id if matched_rules else 'anomaly'}:{now.strftime('%Y%m%d%H%M')[:11]}0",
                count=1,
                first_seen=now,
                last_seen=now,
                resolution_note=reason,
            )
            db.add(alert)

    return action, matched_rule_models, agent.status

# ==============================================================================
# Endpoints
# ==============================================================================

@router.get("/ping")
def ping(auth_info: tuple[Organization, APIKey] = Depends(get_current_org_from_key)):
    """Verifies API key validity and returns org name, scopes, and server version."""
    org, key = auth_info
    return {
        "org": org.name,
        "org_id": org.id,
        "key_prefix": key.prefix,
        "scopes": key.scopes,
        "version": settings.VERSION,
        "status": "operational",
    }

@router.post("/evaluate", response_model=EvaluateResponse)
@router.post("/actions/evaluate", response_model=EvaluateResponse)
def evaluate_action_preflight(
    req: EvaluateRequest,
    auth_info: tuple[Organization, APIKey] = Depends(get_current_org_from_key),
    db: Session = Depends(get_db),
):
    """
    Synchronous pre-flight policy evaluation for AgentShield SDK 'enforce' mode.
    Latency budget: p95 < 50ms.
    """
    org, key = auth_info
    check_key_limits(key, required_scope="evaluate")

    event = ActionEvent(
        event_id=str(uuid.uuid4()),
        agent_id=req.agent_id,
        action_type=req.action_type,
        tool_name=req.tool_name,
        parameters=req.parameters,
        session_id=req.session_id,
    )

    action, matched_rules, agent_status = process_single_action(
        event=event,
        org=org,
        db=db,
        persist=req.persist if req.persist is not None else True,
    )
    if req.persist:
        db.commit()

    reasons = [action.reason] if action.reason else []
    violated_rule_ids = [r.id for r in matched_rules]

    return EvaluateResponse(
        decision=action.decision,
        risk_score=action.risk_score,
        severity=action.severity,
        reasons=reasons,
        matched_rules=[{"id": r.id, "name": r.name, "severity": r.severity} for r in matched_rules],
        agent_status=agent_status,
        evaluation_id=action.id,
        persisted=req.persist if req.persist is not None else True,
        violated_rules=violated_rule_ids,
        anomaly_score=action.anomaly_score,
    )

@router.post("/actions", status_code=status.HTTP_200_OK)
@router.post("/actions/batch", status_code=status.HTTP_202_ACCEPTED, response_model=BatchIngestResponse)
async def ingest_actions_batch(
    payload: Union[BatchIngestRequest, ActionEvent, Dict[str, Any]],
    request: Request,
    auth_info: tuple[Organization, APIKey] = Depends(get_current_org_from_key),
    db: Session = Depends(get_db),
):
    """
    Ingests single or batch telemetry events (up to 500 actions).
    Idempotent on (org_id, event_id). Duplicates are counted, not re-processed.
    """
    org, key = auth_info
    check_key_limits(key, required_scope="ingest")

    # Normalize input
    events: List[ActionEvent] = []
    if isinstance(payload, BatchIngestRequest):
        events = payload.events
    elif isinstance(payload, ActionEvent):
        events = [payload]
    elif isinstance(payload, dict):
        if "events" in payload and isinstance(payload["events"], list):
            events = [ActionEvent(**ev) for ev in payload["events"]]
        elif "actions" in payload and isinstance(payload["actions"], list):
            events = [ActionEvent(**ev) for ev in payload["actions"]]
        else:
            events = [ActionEvent(**payload)]

    if len(events) > 500:
        raise ProblemException(
            status_code=400,
            title="Batch Limit Exceeded",
            detail="Maximum allowed batch size is 500 events per request.",
        )

    accepted_count = 0
    duplicate_count = 0
    results: List[EventResult] = []
    latest_agent_status = "active"
    seen_event_ids_in_batch = set()

    for event in events:
        # Idempotency check on (org_id, event_id)
        if event.event_id:
            if event.event_id in seen_event_ids_in_batch:
                duplicate_count += 1
                continue
            existing = (
                db.query(Action)
                .filter(Action.org_id == org.id, Action.event_id == event.event_id)
                .first()
            )
            if existing:
                duplicate_count += 1
                continue
            seen_event_ids_in_batch.add(event.event_id)

        action, matched_rules, agent_status = process_single_action(
            event=event,
            org=org,
            db=db,
            persist=True,
        )
        accepted_count += 1
        latest_agent_status = agent_status

        results.append(
            EventResult(
                event_id=action.event_id,
                risk_score=action.risk_score,
                severity=action.severity,
                decision=action.decision,
                matched_rules=matched_rules,
            )
        )

        # Broadcast telemetry event over WebSockets
        ws_event = {
            "type": "ACTION_EVENT",
            "org_id": org.id,
            "action_id": action.id,
            "agent": event.agent_id,
            "action": event.action_type,
            "risk": action.risk_score,
            "anomaly": action.anomaly_score,
            "status": action.severity.capitalize(),
            "time": action.timestamp.strftime("%H:%M:%S"),
        }
        await ws_manager.broadcast_agent_event(event.agent_id, ws_event)

    db.commit()

    # If it was a single event called via legacy POST /actions, return legacy response shape if requested
    if len(events) == 1 and "/batch" not in request.url.path:
        first_res = results[0] if results else None
        return {
            "action_id": first_res.event_id if first_res else "unknown",
            "agent_id": events[0].agent_id,
            "action_type": events[0].action_type,
            "risk_score": first_res.risk_score if first_res else 0.0,
            "decision": first_res.decision if first_res else "allow",
            "agent_status": latest_agent_status,
        }

    return BatchIngestResponse(
        accepted=accepted_count,
        duplicates=duplicate_count,
        agent_status=latest_agent_status,
        results=results,
    )

@router.post("/actions/bulk")
async def bulk_ingest_compat(
    bulk_in: LegacyBulkCreate,
    request: Request,
    auth_info: tuple[Organization, APIKey] = Depends(get_current_org_from_key),
    db: Session = Depends(get_db),
):
    """Legacy endpoint backward compatibility alias."""
    return await ingest_actions_batch(
        payload=BatchIngestRequest(events=bulk_in.actions),
        request=request,
        auth_info=auth_info,
        db=db,
    )
