"""
agentshield.integrations.langchain — LangChain & LangGraph Security Callback Handler.
Intercepts tool invocations, prompts, and chain executions to provide real-time
telemetry observation and pre-execution guardrail enforcement.
"""

import time
import logging
from typing import Dict, Any, List, Optional
from uuid import UUID

try:
    from langchain_core.callbacks.base import BaseCallbackHandler
except ImportError:
    class BaseCallbackHandler:  # type: ignore
        """Fallback base class when langchain-core is not installed."""
        pass

from ..client import AgentShield
from ..exceptions import ShieldSecurityException
from ..redaction import redact_secrets

logger = logging.getLogger("agentshield.langchain")


class AgentShieldCallbackHandler(BaseCallbackHandler):
    """
    LangChain callback handler that streams agent execution traces to AgentShield.
    Enforces security policies synchronously in 'enforce' mode and logs telemetry non-blockingly.
    """

    def __init__(
        self,
        shield: Optional[AgentShield] = None,
        agent_id: str = "langchain_agent",
        enforce: Optional[bool] = None,
    ):
        super().__init__()
        self.shield = shield or AgentShield()
        self.agent_id = agent_id
        self.enforce = (self.shield.mode == "enforce") if enforce is None else enforce
        self._start_times: Dict[str, float] = {}

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id: Optional[UUID] = None,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Called before a tool is invoked."""
        tool_name = serialized.get("name") or "unknown_tool"
        r_id = str(run_id) if run_id else tool_name
        self._start_times[r_id] = time.perf_counter()

        # Parse parameters
        params = {"input": input_str}
        if isinstance(kwargs.get("inputs"), dict):
            params.update(kwargs["inputs"])

        # Synchronous pre-flight check in enforce mode
        if self.enforce:
            eval_res = self.shield.evaluate(
                agent_id=self.agent_id,
                action_type=f"tool:{tool_name}",
                parameters=params,
            )
            if eval_res.decision == "deny" and not self.shield.fail_open:
                raise ShieldSecurityException(
                    message=f"LangChain tool '{tool_name}' blocked by AgentShield guardrail.",
                    decision="deny",
                    violated_rules=eval_res.violated_rules,
                    risk_score=eval_res.risk_score,
                    reasons=eval_res.reasons,
                    action_type=f"tool:{tool_name}",
                    agent_id=self.agent_id,
                )

    def on_tool_end(
        self,
        output: Any,
        *,
        run_id: Optional[UUID] = None,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Called after a tool executes successfully."""
        r_id = str(run_id) if run_id else "unknown_tool"
        start_t = self._start_times.pop(r_id, time.perf_counter())
        dur_ms = (time.perf_counter() - start_t) * 1000

        self.shield.log_action(
            agent_id=self.agent_id,
            action_type="tool_execution",
            tool_name=kwargs.get("name") or "tool",
            parameters=redact_secrets({"output_length": len(str(output))}),
            output_excerpt=str(output)[:200] if output else None,
            latency_ms=round(dur_ms, 2),
        )

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: Optional[UUID] = None,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Called if a tool execution raises an error."""
        r_id = str(run_id) if run_id else "unknown_tool"
        start_t = self._start_times.pop(r_id, time.perf_counter())
        dur_ms = (time.perf_counter() - start_t) * 1000

        self.shield.log_action(
            agent_id=self.agent_id,
            action_type="tool_error",
            tool_name=kwargs.get("name") or "tool",
            error=str(error),
            latency_ms=round(dur_ms, 2),
        )

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Called when LLM generation begins."""
        model_name = serialized.get("name") or "llm"
        for prompt in prompts:
            self.shield.log_action(
                agent_id=self.agent_id,
                action_type="llm_prompt",
                parameters={"model": model_name, "prompt_preview": prompt[:150]},
            )
