"""
agentshield.integrations.crewai — CrewAI Agent Telemetry and Guardrail Integration.
Captures task delegations, tool executions, and multi-agent reasoning traces.
"""

import time
import logging
from typing import Any, Dict, Optional

from ..client import AgentShield
from ..exceptions import ShieldSecurityException
from ..redaction import redact_secrets

logger = logging.getLogger("agentshield.crewai")


class CrewAIShieldListener:
    """
    Hooks into CrewAI task lifecycles and tool calls to stream security telemetry to AgentShield.
    """

    def __init__(
        self,
        shield: Optional[AgentShield] = None,
        agent_id: str = "crewai_agent",
        enforce: Optional[bool] = None,
    ):
        self.shield = shield or AgentShield()
        self.agent_id = agent_id
        self.enforce = (self.shield.mode == "enforce") if enforce is None else enforce

    def before_tool_execution(self, tool_name: str, tool_input: Dict[str, Any]) -> None:
        """Called before a CrewAI agent executes a tool."""
        if self.enforce:
            eval_res = self.shield.evaluate(
                agent_id=self.agent_id,
                action_type=f"crewai:tool:{tool_name}",
                parameters=redact_secrets(tool_input),
            )
            if eval_res.decision == "deny" and not self.shield.fail_open:
                raise ShieldSecurityException(
                    message=f"CrewAI tool '{tool_name}' blocked by AgentShield guardrail.",
                    decision="deny",
                    violated_rules=eval_res.violated_rules,
                    risk_score=eval_res.risk_score,
                    reasons=eval_res.reasons,
                    action_type=f"crewai:tool:{tool_name}",
                    agent_id=self.agent_id,
                )

    def after_tool_execution(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        tool_output: Any,
        duration_ms: float = 0.0,
    ) -> None:
        """Called after a CrewAI agent completes tool execution."""
        self.shield.log_action(
            agent_id=self.agent_id,
            action_type="crewai_tool_call",
            tool_name=tool_name,
            parameters=redact_secrets(tool_input),
            output_excerpt=str(tool_output)[:200] if tool_output else None,
            latency_ms=round(duration_ms, 2),
        )

    def on_task_start(self, task_name: str, task_description: Optional[str] = None) -> None:
        """Logs CrewAI task start."""
        self.shield.log_action(
            agent_id=self.agent_id,
            action_type="crewai_task_start",
            parameters={"task": task_name, "description": task_description},
        )

    def on_task_complete(self, task_name: str, output: str) -> None:
        """Logs CrewAI task completion."""
        self.shield.log_action(
            agent_id=self.agent_id,
            action_type="crewai_task_complete",
            parameters={"task": task_name, "output_preview": output[:150]},
        )

