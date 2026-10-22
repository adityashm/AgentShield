"""
sdk/python/tests/test_integrations.py — Tests for Framework Integrations (LangChain, CrewAI, OpenAI).
"""

import pytest
from unittest.mock import patch, MagicMock

from agentshield import (
    AgentShield,
    AgentShieldCallbackHandler,
    CrewAIShieldListener,
    OpenAIAgentShield,
    ShieldSecurityException,
)


def test_langchain_callback_handler_observe():
    shield = AgentShield(api_key="ashield_live_test", mode="observe")
    handler = AgentShieldCallbackHandler(shield=shield, agent_id="support_bot")

    with patch.object(shield, "log_action") as mock_log:
        # 1. Tool start
        handler.on_tool_start(
            serialized={"name": "calculator"},
            input_str="2 + 2",
        )

        # 2. Tool end
        handler.on_tool_end(
            output="4",
            name="calculator",
        )

        assert mock_log.called
        args, kwargs = mock_log.call_args
        assert kwargs["action_type"] == "tool_execution"
        assert kwargs["tool_name"] == "calculator"
        assert kwargs["output_excerpt"] == "4"

    shield.close()


def test_langchain_callback_handler_enforce_block():
    shield = AgentShield(api_key="ashield_live_test", mode="enforce", fail_open=False)
    handler = AgentShieldCallbackHandler(shield=shield, agent_id="security_bot", enforce=True)

    mock_eval = MagicMock()
    mock_eval.decision = "deny"
    mock_eval.violated_rules = ["RUL-001"]
    mock_eval.risk_score = 99.0
    mock_eval.reasons = ["Unauthorized directory traversal blocked"]

    with patch.object(shield, "evaluate", return_value=mock_eval):
        with pytest.raises(ShieldSecurityException) as exc_info:
            handler.on_tool_start(
                serialized={"name": "file_reader"},
                input_str="/etc/shadow",
            )

        assert exc_info.value.decision == "deny"
        assert "RUL-001" in exc_info.value.violated_rules

    shield.close()


def test_crewai_listener():
    shield = AgentShield(api_key="ashield_live_test", mode="observe")
    listener = CrewAIShieldListener(shield=shield, agent_id="research_agent")

    with patch.object(shield, "log_action") as mock_log:
        listener.before_tool_execution("web_search", {"query": "LangChain tutorial"})
        listener.after_tool_execution("web_search", {"query": "LangChain tutorial"}, "Search results...", duration_ms=45.0)
        listener.on_task_complete("research_topic", "Summary of findings")

        assert mock_log.call_count == 2

    shield.close()


def test_openai_agent_wrapper():
    shield = AgentShield(api_key="ashield_live_test", mode="enforce", fail_open=False)
    wrapper = OpenAIAgentShield(shield=shield, agent_id="assistant_01")

    # Safe tool call
    mock_eval_safe = MagicMock()
    mock_eval_safe.decision = "allow"

    with patch.object(shield, "evaluate", return_value=mock_eval_safe):
        res = wrapper.execute_tool_call(
            tool_name="get_weather",
            arguments_json='{"location": "San Francisco"}',
            tool_callable=lambda location: f"Sunny in {location}",
        )
        assert res == "Sunny in San Francisco"

    # Malicious tool call blocked
    mock_eval_deny = MagicMock()
    mock_eval_deny.decision = "deny"
    mock_eval_deny.violated_rules = ["RUL-003"]
    mock_eval_deny.risk_score = 95.0
    mock_eval_deny.reasons = ["Unauthorized execution blocked"]

    with patch.object(shield, "evaluate", return_value=mock_eval_deny):
        with pytest.raises(ShieldSecurityException):
            wrapper.execute_tool_call(
                tool_name="bash_exec",
                arguments_json='{"command": "rm -rf /"}',
                tool_callable=lambda command: "Executed",
            )

    shield.close()
