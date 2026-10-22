"""
agentshield.integrations.openai — OpenAI Assistants & Agents SDK Security Wrapper.
Provides telemetry monitoring and pre-flight evaluation on OpenAI tool calls and assistant runs.
"""

import time
import json
import logging
from typing import Any, Dict, Optional, Callable

from ..client import AgentShield
from ..exceptions import ShieldSecurityException
from ..redaction import redact_secrets

logger = logging.getLogger("agentshield.openai")


class OpenAIAgentShield:
    """
    Wrapper around OpenAI client or Assistants API tool calls to automatically
    evaluate permissions and log telemetry to AgentShield.
    """

    def __init__(
        self,
        shield: Optional[AgentShield] = None,
        agent_id: str = "openai_assistant",
        enforce: Optional[bool] = None,
    ):
        self.shield = shield or AgentShield()
        self.agent_id = agent_id
        self.enforce = (self.shield.mode == "enforce") if enforce is None else enforce

    def execute_tool_call(self, tool_name: str, arguments_json: str, tool_callable: Callable) -> Any:
        """
        Evaluates tool call arguments before execution, executes the function,
        and logs the outcome to AgentShield.
        """
        try:
            params = json.loads(arguments_json) if isinstance(arguments_json, str) else arguments_json
        except Exception:
            params = {"raw_arguments": arguments_json}

        # 1. Enforce pre-flight check
        if self.enforce:
            eval_res = self.shield.evaluate(
                agent_id=self.agent_id,
                action_type=f"openai:tool:{tool_name}",
                parameters=redact_secrets(params),
            )
            if eval_res.decision == "deny" and not self.shield.fail_open:
                raise ShieldSecurityException(
                    message=f"OpenAI tool call '{tool_name}' blocked by AgentShield guardrail.",
                    decision="deny",
                    violated_rules=eval_res.violated_rules,
                    risk_score=eval_res.risk_score,
                    reasons=eval_res.reasons,
                    action_type=f"openai:tool:{tool_name}",
                    agent_id=self.agent_id,
                )

        # 2. Execute target function
        start_t = time.perf_counter()
        err = None
        result = None
        try:
            if isinstance(params, dict):
                result = tool_callable(**params)
            else:
                result = tool_callable(params)
            return result
        except Exception as exc:
            err = str(exc)
            raise
        finally:
            dur_ms = (time.perf_counter() - start_t) * 1000
            self.shield.log_action(
                agent_id=self.agent_id,
                action_type="openai_tool_call",
                tool_name=tool_name,
                parameters=redact_secrets(params),
                output_excerpt=str(result)[:200] if result else None,
                latency_ms=round(dur_ms, 2),
                error=err,
            )

    def tool(self, name: Optional[str] = None):
        """Decorator to wrap a python function as a monitored OpenAI tool."""
        def decorator(func: Callable):
            tool_name = name or func.__name__
            def wrapper(**kwargs):
                return self.execute_tool_call(
                    tool_name=tool_name,
                    arguments_json=json.dumps(kwargs),
                    tool_callable=func,
                )
            return wrapper
        return decorator

