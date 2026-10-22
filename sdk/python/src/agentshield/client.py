"""
agentshield.client — Core AgentShield Python SDK Client.
Provides non-blocking observe telemetry, pre-flight enforce guardrails, and framework wrappers.
"""

import os
import time
import inspect
import functools
import logging
from typing import Dict, Any, Optional, Callable, List
import httpx

from .models import ActionPayload, EvaluationResult, PingResponse
from .exceptions import ShieldSecurityException, ShieldConnectionException, ShieldConfigurationException
from .context import get_current_agent_id, get_current_session_id, session, AgentShieldSession
from .queue import TelemetryQueue
from .guard import evaluate_action_sync, evaluate_action_async
from .redaction import redact_secrets

logger = logging.getLogger("agentshield")


class AgentShield:
    """
    AgentShield Synchronous Client SDK.
    Monitors autonomous AI agent behaviour, detects prompt injections, unauthorized tool access,
    and anomalous actions in real-time.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        mode: str = "observe",
        fail_open: bool = True,
        timeout: float = 1.5,
        default_agent_id: str = "default_agent",
        batch_interval: float = 0.5,
        auto_flush: bool = True,
    ):
        raw_key = api_key or os.getenv("AGENTSHIELD_API_KEY")
        if not raw_key:
            raise ShieldConfigurationException(
                "Missing AgentShield API Key. Pass `api_key` or set `AGENTSHIELD_API_KEY` environment variable."
            )
        self.api_key = raw_key.strip()

        ep = endpoint or os.getenv("AGENTSHIELD_ENDPOINT") or "http://localhost:8000/api/v1"
        self.endpoint = ep.rstrip("/")
        self.mode = mode.lower()
        self.fail_open = fail_open
        self.timeout = timeout
        self.default_agent_id = default_agent_id
        self.auto_flush = auto_flush

        self._headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
            "User-Agent": "AgentShield-Python-SDK/1.0.0",
        }

        # Initialize non-blocking background queue
        self._queue = TelemetryQueue(
            endpoint=self.endpoint,
            headers=self._headers,
            flush_interval=batch_interval,
        )

    def ping(self) -> PingResponse:
        """Verifies connectivity with the AgentShield backend."""
        url = f"{self.endpoint}/ping"
        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.get(url, headers=self._headers)
                if res.status_code == 200:
                    data = res.json()
                    return PingResponse(
                        status=data.get("status", "ok"),
                        organization=data.get("organization"),
                        scopes=data.get("scopes", []),
                        key_prefix=data.get("prefix"),
                    )
                raise ShieldConnectionException(f"Ping returned HTTP {res.status_code}: {res.text}")
        except Exception as exc:
            raise ShieldConnectionException(f"Failed to reach AgentShield at {url}: {exc}")

    def evaluate(
        self,
        agent_id: Optional[str] = None,
        action_type: str = "generic_action",
        parameters: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> EvaluationResult:
        """
        Synchronous pre-flight evaluate request.
        Returns EvaluationResult ('allow', 'review', 'deny').
        """
        effective_agent = agent_id or get_current_agent_id() or self.default_agent_id
        effective_session = session_id or get_current_session_id()
        return evaluate_action_sync(
            endpoint=self.endpoint,
            headers=self._headers,
            agent_id=effective_agent,
            action_type=action_type,
            parameters=parameters or {},
            session_id=effective_session,
            timeout=self.timeout,
            fail_open=self.fail_open,
        )

    def log_action(
        self,
        agent_id: Optional[str] = None,
        action_type: str = "generic_action",
        tool_name: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
        output_excerpt: Optional[str] = None,
        latency_ms: Optional[float] = None,
        error: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        """Non-blockingly enqueues an action event for async telemetry ingestion."""
        effective_agent = agent_id or get_current_agent_id() or self.default_agent_id
        effective_session = session_id or get_current_session_id()

        action = ActionPayload(
            agent_id=effective_agent,
            session_id=effective_session,
            action_type=action_type,
            tool_name=tool_name,
            parameters=parameters or {},
            output_excerpt=output_excerpt,
            latency_ms=latency_ms,
            error=error,
        )
        self._queue.enqueue(action.to_dict())

    def session(self, agent_id: Optional[str] = None, session_id: Optional[str] = None) -> AgentShieldSession:
        """Context manager scoping telemetry to a specific agent session."""
        target_agent = agent_id or self.default_agent_id
        return session(agent_id=target_agent, session_id=session_id)

    def monitor(
        self,
        action_type: Optional[str] = None,
        agent_id: Optional[str] = None,
        enforce: Optional[bool] = None,
    ):
        """
        Decorator wrapping Python functions or tools.
        Enforces policy pre-flight (if mode='enforce') and records telemetry automatically.
        """
        should_enforce = (self.mode == "enforce") if enforce is None else enforce

        def decorator(func: Callable):
            act_name = action_type or getattr(func, "__name__", "function_call")

            if inspect.iscoroutinefunction(func):
                @functools.wraps(func)
                async def async_wrapper(*args, **kwargs):
                    target_agent = agent_id or get_current_agent_id() or self.default_agent_id
                    params = self._extract_call_params(func, args, kwargs)

                    if should_enforce:
                        await evaluate_action_async(
                            endpoint=self.endpoint,
                            headers=self._headers,
                            agent_id=target_agent,
                            action_type=act_name,
                            parameters=params,
                            session_id=get_current_session_id(),
                            timeout=self.timeout,
                            fail_open=self.fail_open,
                        )

                    start_t = time.perf_counter()
                    err = None
                    result = None
                    try:
                        result = await func(*args, **kwargs)
                        return result
                    except Exception as exc:
                        err = str(exc)
                        raise
                    finally:
                        dur_ms = (time.perf_counter() - start_t) * 1000
                        self.log_action(
                            agent_id=target_agent,
                            action_type=act_name,
                            parameters=params,
                            latency_ms=round(dur_ms, 2),
                            error=err,
                        )

                return async_wrapper
            else:
                @functools.wraps(func)
                def sync_wrapper(*args, **kwargs):
                    target_agent = agent_id or get_current_agent_id() or self.default_agent_id
                    params = self._extract_call_params(func, args, kwargs)

                    if should_enforce:
                        evaluate_action_sync(
                            endpoint=self.endpoint,
                            headers=self._headers,
                            agent_id=target_agent,
                            action_type=act_name,
                            parameters=params,
                            session_id=get_current_session_id(),
                            timeout=self.timeout,
                            fail_open=self.fail_open,
                        )

                    start_t = time.perf_counter()
                    err = None
                    try:
                        return func(*args, **kwargs)
                    except Exception as exc:
                        err = str(exc)
                        raise
                    finally:
                        dur_ms = (time.perf_counter() - start_t) * 1000
                        self.log_action(
                            agent_id=target_agent,
                            action_type=act_name,
                            parameters=params,
                            latency_ms=round(dur_ms, 2),
                            error=err,
                        )

                return sync_wrapper

        return decorator

    def _extract_call_params(self, func: Callable, args: tuple, kwargs: dict) -> Dict[str, Any]:
        params = {}
        try:
            sig = inspect.signature(func)
            bound = sig.bind_partial(*args, **kwargs)
            for k, v in bound.arguments.items():
                if k in ("self", "cls"):
                    continue
                params[k] = v
        except Exception:
            params = {"args": str(args), "kwargs": str(kwargs)}
        return redact_secrets(params)

    def flush(self):
        """Flushes all queued events."""
        self._queue.flush()

    def close(self):
        """Flushes queue and cleans up background worker."""
        self._queue.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
