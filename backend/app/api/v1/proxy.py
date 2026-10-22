"""
backend/app/api/v1/proxy.py — Universal AI Gateway Proxy.
Provides OpenAI-compatible endpoints (/v1/chat/completions, /v1/models) with
synchronous pre-flight policy evaluation, guardrail enforcement, and automated telemetry.
"""

import time
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Union
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...database import get_db
from ...db.models import Action, Agent, Alert, Organization, APIKey
from ...services.rule_engine import RuleEngine
from ...services.ml_engine import ml_engine
from ...services.risk_calculator import RiskCalculator
from ...services.websocket_manager import ws_manager
from ...services.playbook_engine import PlaybookEngine
from ...core.config import settings
from ...core.deps import get_current_org_from_key

router = APIRouter(tags=["Universal AI Gateway Proxy"])

# ==============================================================================
# OpenAI Schema Compatibility Models
# ==============================================================================

class ChatMessage(BaseModel):
    role: str
    content: Optional[Union[str, List[Any]]] = ""
    name: Optional[str] = None
    function_call: Optional[Dict[str, Any]] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None

class ChatCompletionRequest(BaseModel):
    model: str = "gpt-4o"
    messages: List[ChatMessage]
    tools: Optional[List[Dict[str, Any]]] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: Optional[bool] = False
    user: Optional[str] = None

class ModelItem(BaseModel):
    id: str
    object: str = "model"
    created: int = 1710000000
    owned_by: str = "agentshield"

class ModelListResponse(BaseModel):
    object: str = "list"
    data: List[ModelItem]

# ==============================================================================
# Helper functions
# ==============================================================================

def extract_prompt_text(messages: List[ChatMessage]) -> str:
    """Concatenates all user and system message contents for threat scanning."""
    parts = []
    for m in messages:
        if m.content:
            if isinstance(m.content, str):
                parts.append(m.content)
            elif isinstance(m.content, list):
                for item in m.content:
                    if isinstance(item, dict) and "text" in item:
                        parts.append(str(item["text"]))
                    elif isinstance(item, str):
                        parts.append(item)
        if m.tool_calls:
            for tc in m.tool_calls:
                func = tc.get("function", {})
                if "arguments" in func:
                    parts.append(str(func["arguments"]))
    return "\n".join(parts)

def extract_tool_parameters(request: ChatCompletionRequest) -> Dict[str, Any]:
    """Flattens tool parameters and prompts into an inspection dictionary."""
    params: Dict[str, Any] = {
        "prompt": extract_prompt_text(request.messages),
        "model": request.model,
    }
    # Check for direct path or command references in user text
    full_text = params["prompt"]
    if "/" in full_text or "\\" in full_text:
        # Potential file path
        words = full_text.split()
        for w in words:
            if w.startswith("/") or w.startswith("C:\\") or ".env" in w or "shadow" in w or "passwd" in w:
                params["path"] = w.strip(";'\",")
                break
    if any(sh in full_text for sh in ["curl", "wget", "bash", "sh", "rm -rf", "sudo"]):
        params["command"] = full_text

    if request.tools:
        params["tool_definitions"] = [t.get("function", {}).get("name") for t in request.tools]
    return params

# ==============================================================================
# Endpoints
# ==============================================================================

@router.get("/models", response_model=ModelListResponse)
def list_models():
    """OpenAI-compatible models catalog endpoint."""
    return ModelListResponse(
        data=[
            ModelItem(id="gpt-4o"),
            ModelItem(id="gpt-4o-mini"),
            ModelItem(id="gpt-4-turbo"),
            ModelItem(id="claude-3-5-sonnet"),
            ModelItem(id="agentshield-guardrail-enforced"),
        ]
    )

@router.post("/chat/completions")
async def chat_completions(
    request: Request,
    body: ChatCompletionRequest,
    x_agent_id: Optional[str] = Header(None, alias="X-Agent-ID"),
    db: Session = Depends(get_db),
    auth_context: tuple[Organization, APIKey] = Depends(get_current_org_from_key),
):
    """
    OpenAI-compatible /chat/completions gateway.
    Inspects messages and tools pre-flight before upstream routing or completion.
    Blocks adversarial inputs with an RFC 7807 problem json / OpenAI-compatible error.
    """
    start_time = time.perf_counter()
    org, api_key = auth_context
    agent_id = x_agent_id or body.user or "universal_proxy_agent"
    now = datetime.now(timezone.utc)

    # 1. Resolve or register agent
    agent = db.query(Agent).filter(Agent.external_id == agent_id, Agent.org_id == org.id).first()
    if not agent:
        agent = Agent(
            id=f"{org.id}_{agent_id}",
            org_id=org.id,
            external_id=agent_id,
            name=f"Proxy Agent ({agent_id})",
            framework="OpenAI Proxy",
            environment="production",
            status="active",
            risk_score=0.0,
            first_seen=now,
            last_seen=now,
        )
        db.add(agent)
        db.flush()
    else:
        agent.last_seen = now

    # 2. Extract inspection payload
    inspection_params = extract_tool_parameters(body)
    eval_payload = {
        "action_type": "chat_completion",
        "parameters": inspection_params,
        "model": body.model,
    }

    # 3. Safe AST Rule Evaluation
    matched_rules, rule_severity = RuleEngine.evaluate_action(eval_payload, db)

    # 4. ML Anomaly Scoring
    anomaly_score = ml_engine.predict_anomaly_score({
        "action_type": "chat_completion",
        "parameters": inspection_params,
        "call_frequency": 35.0 if matched_rules else 10.0,
        "session_duration": 120.0,
    })

    if rule_severity >= 75.0:
        anomaly_score = max(anomaly_score, 0.85)

    risk_score = RiskCalculator.calculate_action_risk(rule_severity, anomaly_score)

    # 5. Quarantine / Policy Gate
    is_blocked = False
    block_reason = None
    violated_rule_ids = [getattr(r, "id", str(r)) for r in matched_rules]

    if agent.status in ("quarantined", "halted", "suspended"):
        is_blocked = True
        block_reason = f"Agent {agent_id} is quarantined in AgentShield"
        risk_score = 95.0
    elif any(getattr(r, "mode", "alert") == "block" or getattr(r, "severity", "").lower() in ("critical", "high") for r in matched_rules) or risk_score >= settings.BLOCK_THRESHOLD:
        is_blocked = True
        risk_score = max(risk_score, 90.0)
        rule_name = matched_rules[0].name if matched_rules else "Security Policy"
        block_reason = f"Blocked by AgentShield Guardrail: {rule_name}"

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # 6. Record action event in database
    action_record = Action(
        action_id=str(uuid.uuid4()),
        org_id=org.id,
        agent_id=agent.id,
        action_type="chat_completion",
        parameters=inspection_params,
        timestamp=now,
        risk_score=risk_score,
        anomaly_score=anomaly_score,
        status="blocked" if is_blocked else "allowed",
    )
    db.add(action_record)

    # 7. Create Alert if threshold breached
    alert_created = None
    if is_blocked or risk_score >= settings.ALERT_THRESHOLD:
        alert_id = f"ALT-{uuid.uuid4().hex[:6].upper()}"
        alert_record = Alert(
            id=alert_id,
            org_id=org.id,
            agent_id=agent.id,
            action_id=action_record.action_id,
            severity="Critical" if is_blocked else "High",
            status="Open",
            risk_score=risk_score,
            trigger_type="policy_violation" if matched_rules else "anomaly",
            notes=block_reason or f"High risk proxy request detected (Score: {risk_score:.1f})",
            created_at=now,
            rule_id=violated_rule_ids[0] if violated_rule_ids else None,
        )
        db.add(alert_record)
        alert_created = alert_id

    # Update agent risk score
    agent.risk_score = (agent.risk_score * 0.7) + (risk_score * 0.3)
    db.commit()

    # Trigger Automated Remediation Playbooks if alert was generated
    if alert_created and alert_record:
        try:
            await PlaybookEngine.evaluate_alert(alert_record, db)
        except Exception:
            pass

    # 8. Emit Real-time WebSocket Event
    await ws_manager.broadcast({
        "type": "EVALUATE_EVENT" if is_blocked else "ACTION_EVENT",
        "agent": agent.external_id,
        "action": f"OpenAI Proxy: {body.model}",
        "risk": round(risk_score, 1),
        "decision": "deny" if is_blocked else "allow",
        "tone": "danger" if is_blocked else "warning" if risk_score >= 50 else "success",
        "status": "Critical" if is_blocked else "Suspicious" if risk_score >= 50 else "Normal",
        "time": now.strftime("%H:%M:%S.%f")[:-3],
        "latency_ms": elapsed_ms,
        "rules": violated_rule_ids,
        "alert_id": alert_created,
    })

    # 9. Return Response
    if is_blocked:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "message": block_reason,
                    "type": "agentshield_guardrail_violation",
                    "param": "messages",
                    "code": "threat_blocked",
                    "violated_rules": violated_rule_ids,
                    "risk_score": risk_score,
                    "latency_ms": elapsed_ms,
                }
            },
        )

    # Upstream pass-through or simulated completion
    prompt_words = len(inspection_params.get("prompt", "").split())
    completion_id = f"chatcmpl-ashield-{uuid.uuid4().hex[:12]}"
    
    return {
        "id": completion_id,
        "object": "chat.completion",
        "created": int(now.timestamp()),
        "model": body.model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Action inspected and permitted by AgentShield Guardrail Gateway. Prompt and tools verified compliant.",
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": max(1, prompt_words),
            "completion_tokens": 16,
            "total_tokens": max(1, prompt_words) + 16,
        },
        "agentshield": {
            "verified": True,
            "risk_score": round(risk_score, 1),
            "decision": "allow",
            "latency_ms": elapsed_ms,
        },
    }

class ProxyTestRequest(BaseModel):
    prompt: str
    model: Optional[str] = "gpt-4o"
    mode: Optional[str] = "enforce"
    agent_id: Optional[str] = "gateway_tester_agent"

class ProxyTestResponse(BaseModel):
    decision: str
    risk_score: float
    violated_rules: List[str]
    latency_ms: float
    status_code: int
    model: str
    response_text: str
    tokens: Dict[str, int]

@router.post("/proxy/test", response_model=ProxyTestResponse)
@router.post("/test", response_model=ProxyTestResponse)
async def test_proxy(
    body: ProxyTestRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    In-browser Gateway Tester endpoint.
    Synchronously evaluates prompts against Safe AST rules and ML anomaly scoring.
    Broadcasts real-time events to the dashboard and returns comprehensive threat metrics.
    """
    start_time = time.perf_counter()
    org_id = "org_default"
    now = datetime.now(timezone.utc)
    agent_id = body.agent_id or "gateway_tester_agent"
    mode = (body.mode or "enforce").lower()

    # 1. Resolve or register agent
    agent = db.query(Agent).filter(Agent.external_id == agent_id, Agent.org_id == org_id).first()
    if not agent:
        agent = Agent(
            id=f"{org_id}_{agent_id}",
            org_id=org_id,
            external_id=agent_id,
            name=f"Gateway Tester ({agent_id})",
            framework="AI Gateway Tester",
            environment="testing",
            status="active",
            risk_score=0.0,
            first_seen=now,
            last_seen=now,
        )
        db.add(agent)
        db.flush()
    else:
        agent.last_seen = now

    # 2. Extract inspection parameters
    inspection_params: Dict[str, Any] = {
        "prompt": body.prompt,
        "model": body.model or "gpt-4o",
    }
    full_text = body.prompt
    if "/" in full_text or "\\" in full_text:
        words = full_text.split()
        for w in words:
            if w.startswith("/") or w.startswith("C:\\") or ".env" in w or "shadow" in w or "passwd" in w:
                inspection_params["path"] = w.strip(";'\",")
                break
    if any(sh in full_text for sh in ["curl", "wget", "bash", "sh", "rm -rf", "sudo"]):
        inspection_params["command"] = full_text

    eval_payload = {
        "action_type": "chat_completion",
        "parameters": inspection_params,
        "model": body.model or "gpt-4o",
    }

    # 3. Safe AST Rule Evaluation
    matched_rules, rule_severity = RuleEngine.evaluate_action(eval_payload, db)

    # 4. ML Anomaly Scoring
    anomaly_score = ml_engine.predict_anomaly_score({
        "action_type": "chat_completion",
        "parameters": inspection_params,
        "call_frequency": 35.0 if matched_rules else 10.0,
        "session_duration": 120.0,
    })
    if rule_severity >= 75.0:
        anomaly_score = max(anomaly_score, 0.85)
    elif not matched_rules:
        anomaly_score = min(anomaly_score * 0.25, 0.20)

    risk_score = RiskCalculator.calculate_action_risk(rule_severity, anomaly_score)

    # 5. Determine enforcement decision
    violated_rule_ids = [getattr(r, "id", getattr(r, "rule_id", str(r))) for r in matched_rules]
    is_blocked = False
    block_reason = None

    if agent.status in ("quarantined", "halted", "suspended"):
        is_blocked = True
        block_reason = f"Agent {agent_id} is quarantined in AgentShield"
        risk_score = 95.0
    elif any(getattr(r, "mode", "alert") == "block" or getattr(r, "severity", "").lower() in ("critical", "high") for r in matched_rules) or risk_score >= settings.BLOCK_THRESHOLD:
        is_blocked = True
        risk_score = max(risk_score, 90.0)
        rule_name = matched_rules[0].name if matched_rules else "Security Policy"
        block_reason = f"Blocked by AgentShield Guardrail: {rule_name}"

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

    if mode == "observe" and is_blocked:
        decision = "allow"
        status_code = 200
        response_text = f"[Shadow Mode / Observed] Intercepted {len(violated_rule_ids)} guardrail threat(s) ({', '.join(violated_rule_ids)}), but request permitted under Observe mode."
    elif is_blocked:
        decision = "deny"
        status_code = 403
        response_text = f"Action blocked by AgentShield Guardrail Gateway: {block_reason}. Violated rules: {', '.join(violated_rule_ids)}"
    else:
        decision = "allow"
        status_code = 200
        response_text = "Prompt inspected and permitted by AgentShield Guardrail Gateway. Safety policies verified compliant."

    # 6. Record action event in database
    action_record = Action(
        action_id=str(uuid.uuid4()),
        org_id=org_id,
        agent_id=agent.id,
        action_type="chat_completion",
        parameters=inspection_params,
        timestamp=now,
        risk_score=risk_score,
        anomaly_score=anomaly_score,
        status="blocked" if decision == "deny" else "allowed",
    )
    db.add(action_record)

    # 7. Create Alert if threshold breached
    alert_created = None
    if decision == "deny" or risk_score >= settings.ALERT_THRESHOLD:
        alert_id = f"ALT-GW-{uuid.uuid4().hex[:6].upper()}"
        alert_record = Alert(
            id=alert_id,
            org_id=org_id,
            agent_id=agent.id,
            action_id=action_record.action_id,
            severity="Critical" if decision == "deny" else "High",
            status="Open",
            risk_score=risk_score,
            trigger_type="policy_violation" if matched_rules else "anomaly",
            notes=block_reason or f"High risk gateway test detected (Score: {risk_score:.1f})",
            created_at=now,
            rule_id=violated_rule_ids[0] if violated_rule_ids else None,
        )
        db.add(alert_record)
        alert_created = alert_id

    agent.risk_score = (agent.risk_score * 0.7) + (risk_score * 0.3)
    db.commit()

    # 8. Emit Real-time WebSocket Event
    await ws_manager.broadcast({
        "type": "EVALUATE_EVENT" if decision == "deny" else "ACTION_EVENT",
        "agent": agent.external_id,
        "action": f"Gateway Test: {body.model}",
        "risk": round(risk_score, 1),
        "decision": decision,
        "tone": "danger" if decision == "deny" else "warning" if risk_score >= 50 else "success",
        "status": "Critical" if decision == "deny" else "Suspicious" if risk_score >= 50 else "Normal",
        "time": now.strftime("%H:%M:%S.%f")[:-3],
        "latency_ms": elapsed_ms,
        "rules": violated_rule_ids,
        "alert_id": alert_created,
    })

    words = len(body.prompt.split())
    return ProxyTestResponse(
        decision=decision,
        risk_score=round(risk_score, 1),
        violated_rules=violated_rule_ids,
        latency_ms=elapsed_ms,
        status_code=status_code,
        model=body.model or "gpt-4o",
        response_text=response_text,
        tokens={
            "prompt_tokens": max(1, words),
            "completion_tokens": 16,
            "total_tokens": max(1, words) + 16,
        },
    )

