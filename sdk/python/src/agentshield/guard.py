"""
agentshield.guard — Pre-Flight Synchronous Evaluation Guard for Enforce Mode.
Evaluates agent actions before execution with strict latency budgets and fail-open/fail-closed semantics.
"""

import time
import logging
from typing import Dict, Any, Optional
import httpx

from .models import EvaluationResult
from .exceptions import ShieldSecurityException, ShieldConnectionException
from .redaction import redact_secrets

logger = logging.getLogger("agentshield.guard")


def evaluate_action_sync(
    endpoint: str,
    headers: Dict[str, str],
    agent_id: str,
    action_type: str,
    parameters: Dict[str, Any],
    session_id: Optional[str] = None,
    timeout: float = 1.0,
    fail_open: bool = True,
) -> EvaluationResult:
    """
    Synchronously evaluates proposed action against AgentShield threat detection policies.
    """
    clean_params = redact_secrets(parameters)
    payload = {
        "agent_id": agent_id,
        "action_type": action_type,
        "parameters": clean_params,
        "session_id": session_id,
    }

    url = f"{endpoint.rstrip('/')}/evaluate"
    start_time = time.perf_counter()

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload, headers=headers)
            latency_ms = (time.perf_counter() - start_time) * 1000

            if resp.status_code == 200:
                data = resp.json()
                data["latency_ms"] = latency_ms
                result = EvaluationResult(**data)

                if result.decision == "deny" and not fail_open:
                    raise ShieldSecurityException(
                        message=f"Agent action '{action_type}' denied by security policy.",
                        decision=result.decision,
                        violated_rules=result.violated_rules,
                        risk_score=result.risk_score,
                        reasons=result.reasons,
                        action_type=action_type,
                        agent_id=agent_id,
                    )
                return result

            elif resp.status_code == 401:
                logger.error("AgentShield pre-flight evaluation failed: Unauthorized API key.")
                if not fail_open:
                    raise ShieldSecurityException("AgentShield API Key unauthorized.")

            else:
                logger.warning(f"AgentShield pre-flight evaluation returned HTTP {resp.status_code}: {resp.text[:200]}")
                if not fail_open:
                    raise ShieldConnectionException(f"AgentShield evaluation failed with status {resp.status_code}")

    except ShieldSecurityException:
        raise
    except Exception as exc:
        logger.warning(f"AgentShield pre-flight evaluate error ({exc}); fail_open={fail_open}")
        if not fail_open:
            raise ShieldConnectionException(f"Failed to communicate with AgentShield: {exc}")

    # Fallback response when fail_open is active
    return EvaluationResult(
        decision="allow",
        risk_score=0.0,
        anomaly_score=0.0,
        violated_rules=[],
        reasons=["Evaluator timeout/fallback: fail-open policy permitted execution."],
    )


async def evaluate_action_async(
    endpoint: str,
    headers: Dict[str, str],
    agent_id: str,
    action_type: str,
    parameters: Dict[str, Any],
    session_id: Optional[str] = None,
    timeout: float = 1.0,
    fail_open: bool = True,
) -> EvaluationResult:
    """
    Asynchronously evaluates proposed action against AgentShield threat detection policies.
    """
    clean_params = redact_secrets(parameters)
    payload = {
        "agent_id": agent_id,
        "action_type": action_type,
        "parameters": clean_params,
        "session_id": session_id,
    }

    url = f"{endpoint.rstrip('/')}/evaluate"
    start_time = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            latency_ms = (time.perf_counter() - start_time) * 1000

            if resp.status_code == 200:
                data = resp.json()
                data["latency_ms"] = latency_ms
                result = EvaluationResult(**data)

                if result.decision == "deny" and not fail_open:
                    raise ShieldSecurityException(
                        message=f"Agent action '{action_type}' denied by security policy.",
                        decision=result.decision,
                        violated_rules=result.violated_rules,
                        risk_score=result.risk_score,
                        reasons=result.reasons,
                        action_type=action_type,
                        agent_id=agent_id,
                    )
                return result

            elif resp.status_code == 401:
                logger.error("AgentShield pre-flight evaluation failed: Unauthorized API key.")
                if not fail_open:
                    raise ShieldSecurityException("AgentShield API Key unauthorized.")

            else:
                logger.warning(f"AgentShield pre-flight evaluation returned HTTP {resp.status_code}")
                if not fail_open:
                    raise ShieldConnectionException(f"AgentShield evaluation failed with status {resp.status_code}")

    except ShieldSecurityException:
        raise
    except Exception as exc:
        logger.warning(f"AgentShield pre-flight evaluate async error ({exc}); fail_open={fail_open}")
        if not fail_open:
            raise ShieldConnectionException(f"Failed to communicate with AgentShield: {exc}")

    return EvaluationResult(
        decision="allow",
        risk_score=0.0,
        anomaly_score=0.0,
        violated_rules=[],
        reasons=["Evaluator timeout/fallback: fail-open policy permitted execution."],
    )
