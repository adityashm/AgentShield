from typing import Dict, Any, List, Optional
import time

try:
    from langchain_core.callbacks import BaseCallbackHandler
except ImportError:
    try:
        from langchain.callbacks.base import BaseCallbackHandler
    except ImportError:
        # Standalone fallback if langchain is not installed in the environment
        class BaseCallbackHandler:
            pass

from .client import AgentShield

class AgentShieldCallbackHandler(BaseCallbackHandler):
    """
    LangChain & CrewAI callback handler for AgentShield AI.
    Attaches to agents to monitor LLM prompt generation, tool execution, and error rates.
    """

    def __init__(self, shield: AgentShield, agent_id: str = "langchain_agent"):
        super().__init__()
        self.shield = shield
        self.agent_id = agent_id
        self._tool_start_times: Dict[str, float] = {}

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id=None,
        **kwargs: Any,
    ) -> None:
        """Inspects outbound LLM prompts for jailbreak patterns."""
        combined_prompt = " ".join(prompts)
        self.shield.log_action(
            agent_id=self.agent_id,
            action_type="prompt_execution",
            parameters={
                "model": serialized.get("name", "llm"),
                "prompt_sample": combined_prompt[:500],
                "char_length": len(combined_prompt),
            },
        )

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id=None,
        **kwargs: Any,
    ) -> None:
        """Fires when agent initiates a tool execution."""
        tool_name = serialized.get("name", "unknown_tool")
        if run_id:
            self._tool_start_times[str(run_id)] = time.perf_counter()

        # In enforce mode, check tool pre-flight
        if self.shield.mode == "enforce":
            self.shield.evaluate(
                agent_id=self.agent_id,
                action_type=tool_name,
                parameters={"input": input_str},
            )

    def on_tool_end(
        self,
        output: str,
        *,
        run_id=None,
        **kwargs: Any,
    ) -> None:
        """Records completed tool action and duration."""
        duration_ms = None
        if run_id and str(run_id) in self._tool_start_times:
            duration_ms = (time.perf_counter() - self._tool_start_times.pop(str(run_id))) * 1000

        self.shield.log_action(
            agent_id=self.agent_id,
            action_type="tool_execution",
            parameters={"output_preview": str(output)[:300]},
            duration_ms=duration_ms,
        )

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id=None,
        **kwargs: Any,
    ) -> None:
        """Flags tool execution failures."""
        duration_ms = None
        if run_id and str(run_id) in self._tool_start_times:
            duration_ms = (time.perf_counter() - self._tool_start_times.pop(str(run_id))) * 1000

        self.shield.log_action(
            agent_id=self.agent_id,
            action_type="tool_error",
            parameters={"error_type": type(error).__name__, "message": str(error)},
            duration_ms=duration_ms,
        )
