import time
import json
import queue
import threading
import functools
import inspect
import requests
import logging
from typing import Dict, Any, Optional, Callable, List
from .exceptions import ShieldSecurityException, ShieldConnectionException

logger = logging.getLogger("agentshield.sdk")

class AgentShield:
    """
    AgentShield Client SDK.
    Provides non-blocking behavioural telemetry observation ('observe')
    and synchronous policy enforcement guardrails ('enforce') for autonomous AI agents.
    """

    def __init__(
        self,
        api_key: str,
        endpoint: str = "http://localhost:8000/api/v1",
        mode: str = "observe",        # "observe" (async non-blocking) or "enforce" (sync guardrail)
        fail_open: bool = True,       # If True, allow action if server fails or times out in enforce mode
        timeout: float = 1.5,
        default_agent_id: str = "default_agent",
        batch_interval: float = 1.0,
    ):
        self.api_key = api_key.strip()
        self.endpoint = endpoint.rstrip("/")
        self.mode = mode.lower()
        self.fail_open = fail_open
        self.timeout = timeout
        self.default_agent_id = default_agent_id
        self.batch_interval = batch_interval

        self._headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
        }

        # Background batching queue for 'observe' mode
        self._queue: queue.Queue = queue.Queue(maxsize=5000)
        self._stop_event = threading.Event()
        self._worker_thread = threading.Thread(target=self._background_batch_worker, daemon=True)
        self._worker_thread.start()

    def evaluate(self, agent_id: str, action_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Synchronous pre-flight call to /actions/evaluate.
        Returns allow, deny, or review.
        """
        url = f"{self.endpoint}/actions/evaluate"
        payload = {
            "agent_id": agent_id,
            "action_type": action_type,
            "parameters": parameters,
        }
        try:
            r = requests.post(url, json=payload, headers=self._headers, timeout=self.timeout)
            if r.status_code == 200:
                return r.json()
            elif r.status_code == 401:
                logger.error("AgentShield API Key rejected (401 Unauthorized).")
                if not self.fail_open:
                    raise ShieldSecurityException("AgentShield API Key unauthorized.")
            else:
                logger.warning(f"AgentShield evaluate returned {r.status_code}: {r.text}")
        except Exception as e:
            logger.warning(f"AgentShield pre-flight evaluation error: {e}")
            if not self.fail_open:
                raise ShieldConnectionException(f"AgentShield connection failed: {e}")

        # Fallback decision
        return {"decision": "allow", "risk_score": 0.0, "anomaly_score": 0.0, "violated_rules": []}

    def log_action(
        self,
        agent_id: Optional[str] = None,
        action_type: str = "generic_action",
        parameters: Optional[Dict[str, Any]] = None,
        duration_ms: Optional[float] = None,
    ):
        """Queue action telemetry non-blockingly."""
        event = {
            "agent_id": agent_id or self.default_agent_id,
            "action_type": action_type,
            "parameters": parameters or {},
        }
        if duration_ms is not None:
            event["parameters"]["duration_ms"] = round(duration_ms, 2)

        try:
            self._queue.put_nowait(event)
        except queue.Full:
            logger.warning("AgentShield telemetry queue is full; dropping event.")

    def monitor(
        self,
        action_type: str,
        agent_id: Optional[str] = None,
        enforce: Optional[bool] = None,
    ):
        """
        Function decorator wrapping tool execution or model invocation.
        Works seamlessly with both synchronous and asynchronous functions.
        """
        should_enforce = (self.mode == "enforce") if enforce is None else enforce

        def decorator(func: Callable):
            target_agent = agent_id or self.default_agent_id

            if inspect.iscoroutinefunction(func):
                @functools.wraps(func)
                async def async_wrapper(*args, **kwargs):
                    params = self._extract_params(func, args, kwargs)

                    # 1. Enforce pre-flight check if configured
                    if should_enforce:
                        eval_res = self.evaluate(target_agent, action_type, params)
                        decision = eval_res.get("decision", "allow")
                        if decision == "deny":
                            violated = eval_res.get("violated_rules", [])
                            risk = eval_res.get("risk_score", 0.0)
                            reason = eval_res.get("reason", "Action blocked by security policy")
                            if not self.fail_open:
                                raise ShieldSecurityException(
                                    f"Security Guardrail Block: {reason}",
                                    decision="deny",
                                    violated_rules=violated,
                                    risk_score=risk,
                                )
                            else:
                                logger.warning(f"[FAIL-OPEN WARNING] Guardrail denied action ({reason}) but fail_open=True.")

                    # 2. Execute target function and record metrics
                    start_t = time.perf_counter()
                    result = None
                    try:
                        result = await func(*args, **kwargs)
                        return result
                    finally:
                        duration_ms = (time.perf_counter() - start_t) * 1000
                        self.log_action(target_agent, action_type, params, duration_ms)

                return async_wrapper
            else:
                @functools.wraps(func)
                def sync_wrapper(*args, **kwargs):
                    params = self._extract_params(func, args, kwargs)

                    # 1. Enforce pre-flight check
                    if should_enforce:
                        eval_res = self.evaluate(target_agent, action_type, params)
                        decision = eval_res.get("decision", "allow")
                        if decision == "deny":
                            violated = eval_res.get("violated_rules", [])
                            risk = eval_res.get("risk_score", 0.0)
                            reason = eval_res.get("reason", "Action blocked by security policy")
                            if not self.fail_open:
                                raise ShieldSecurityException(
                                    f"Security Guardrail Block: {reason}",
                                    decision="deny",
                                    violated_rules=violated,
                                    risk_score=risk,
                                )
                            else:
                                logger.warning(f"[FAIL-OPEN WARNING] Guardrail denied action ({reason}) but fail_open=True.")

                    # 2. Execute target function and record metrics
                    start_t = time.perf_counter()
                    try:
                        return func(*args, **kwargs)
                    finally:
                        duration_ms = (time.perf_counter() - start_t) * 1000
                        self.log_action(target_agent, action_type, params, duration_ms)

                return sync_wrapper

        return decorator

    def _extract_params(self, func: Callable, args: tuple, kwargs: dict) -> Dict[str, Any]:
        """Safely extract function arguments into JSON-serializable parameters."""
        params: Dict[str, Any] = {}
        try:
            sig = inspect.signature(func)
            bound = sig.bind_partial(*args, **kwargs)
            for k, v in bound.arguments.items():
                if k in ("self", "cls"):
                    continue
                # Simple serialization guard
                try:
                    json.dumps(v)
                    params[k] = v
                except Exception:
                    params[k] = str(v)
        except Exception:
            params = {"args_repr": str(args), "kwargs_repr": str(kwargs)}
        return params

    def _background_batch_worker(self):
        """Worker thread draining the queue and dispatching batch telemetry."""
        while not self._stop_event.is_set():
            batch = []
            start_drain = time.time()
            
            while len(batch) < 25 and (time.time() - start_drain) < self.batch_interval:
                try:
                    event = self._queue.get(timeout=0.2)
                    batch.append(event)
                except queue.Empty:
                    break

            if batch:
                self._dispatch_batch(batch)

    def _dispatch_batch(self, batch: List[Dict[str, Any]]):
        """Dispatches action events to FastAPI."""
        try:
            if len(batch) == 1:
                requests.post(
                    f"{self.endpoint}/actions",
                    json=batch[0],
                    headers=self._headers,
                    timeout=3.0,
                )
            else:
                requests.post(
                    f"{self.endpoint}/actions/bulk",
                    json={"actions": batch},
                    headers=self._headers,
                    timeout=5.0,
                )
        except Exception as e:
            logger.debug(f"AgentShield telemetry batch dispatch failed: {e}")

    def flush(self):
        """Flushes all queued events synchronously."""
        while not self._queue.empty():
            batch = []
            while len(batch) < 50 and not self._queue.empty():
                try:
                    batch.append(self._queue.get_nowait())
                except queue.Empty:
                    break
            if batch:
                self._dispatch_batch(batch)

    def close(self):
        """Gracefully flushes remaining telemetry and stops worker thread."""
        self.flush()
        self._stop_event.set()
        if self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)
