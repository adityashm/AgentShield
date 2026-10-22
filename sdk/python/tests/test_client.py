"""
sdk/python/tests/test_client.py — Unit Tests for AgentShield Core Client.
"""

import os
import pytest
import asyncio
from unittest.mock import MagicMock, patch

from agentshield import AgentShield, ShieldConfigurationException, ShieldConnectionException
from agentshield.context import get_current_agent_id, get_current_session_id


def test_client_init_and_env_variables():
    # 1. Error when no key provided
    os.environ.pop("AGENTSHIELD_API_KEY", None)
    with pytest.raises(ShieldConfigurationException):
        AgentShield(api_key=None)

    # 2. Key passed via argument
    shield = AgentShield(api_key="ashield_live_testkey_12345", endpoint="http://localhost:8000/api/v1")
    assert shield.api_key == "ashield_live_testkey_12345"
    assert shield.endpoint == "http://localhost:8000/api/v1"
    shield.close()

    # 3. Key passed via environment variable
    os.environ["AGENTSHIELD_API_KEY"] = "ashield_live_fromenv_99999"
    os.environ["AGENTSHIELD_ENDPOINT"] = "https://shield.corp.internal/api/v1"
    shield_env = AgentShield()
    assert shield_env.api_key == "ashield_live_fromenv_99999"
    assert shield_env.endpoint == "https://shield.corp.internal/api/v1"
    shield_env.close()


def test_session_context_scoping():
    shield = AgentShield(api_key="ashield_live_test")
    assert get_current_agent_id() is None
    assert get_current_session_id() is None

    with shield.session(agent_id="agt_checkout", session_id="sess_alpha"):
        assert get_current_agent_id() == "agt_checkout"
        assert get_current_session_id() == "sess_alpha"

    # Context restored after block exit
    assert get_current_agent_id() is None
    assert get_current_session_id() is None
    shield.close()


def test_monitor_decorator_sync():
    shield = AgentShield(api_key="ashield_live_test", mode="observe")

    @shield.monitor(action_type="math_multiply")
    def multiply(x: int, y: int) -> int:
        return x * y

    with patch.object(shield, "log_action") as mock_log:
        result = multiply(6, 7)
        assert result == 42
        mock_log.assert_called_once()
        args, kwargs = mock_log.call_args
        assert kwargs["action_type"] == "math_multiply"
        assert kwargs["parameters"]["x"] == 6
        assert kwargs["parameters"]["y"] == 7
        assert kwargs["latency_ms"] >= 0.0

    shield.close()


@pytest.mark.asyncio
async def test_monitor_decorator_async():
    shield = AgentShield(api_key="ashield_live_test", mode="observe")

    @shield.monitor(action_type="async_fetch")
    async def async_fetch(url: str) -> str:
        await asyncio.sleep(0.01)
        return f"content from {url}"

    with patch.object(shield, "log_action") as mock_log:
        res = await async_fetch("https://example.com/api")
        assert "content from" in res
        mock_log.assert_called_once()
        args, kwargs = mock_log.call_args
        assert kwargs["action_type"] == "async_fetch"
        assert kwargs["parameters"]["url"] == "https://example.com/api"

    shield.close()


def test_client_ping():
    shield = AgentShield(api_key="ashield_live_test")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "ok",
        "organization": "Acme Corp",
        "scopes": ["ingest", "evaluate"],
        "prefix": "ashield_live_test",
    }

    with patch("httpx.Client.get", return_value=mock_resp):
        res = shield.ping()
        assert res.status == "ok"
        assert res.organization == "Acme Corp"

    with patch("httpx.Client.get", side_effect=Exception("Failed")):
        with pytest.raises(ShieldConnectionException):
            shield.ping()

    shield.close()



def test_client_evaluate_direct():
    shield = AgentShield(api_key="ashield_live_test")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "decision": "allow",
        "risk_score": 10.0,
        "anomaly_score": 0.05,
        "violated_rules": [],
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        res = shield.evaluate(agent_id="agt_1", action_type="read_doc", parameters={"doc": "policy.pdf"})
        assert res.decision == "allow"
        assert res.risk_score == 10.0

    shield.close()

