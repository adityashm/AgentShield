"""
sdk/python/tests/test_enforce_guard.py — Pre-Flight Synchronous Enforcement Tests.
"""

import pytest
from unittest.mock import patch, MagicMock
import httpx

from agentshield import AgentShield, ShieldSecurityException, ShieldConnectionException


def test_enforce_allow_passes():
    shield = AgentShield(api_key="ashield_live_test", mode="enforce", fail_open=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "decision": "allow",
        "risk_score": 12.0,
        "anomaly_score": 0.05,
        "violated_rules": [],
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        @shield.monitor(action_type="safe_calculation")
        def add(a, b):
            return a + b

        result = add(10, 20)
        assert result == 30

    shield.close()


def test_enforce_deny_raises_security_exception():
    shield = AgentShield(api_key="ashield_live_test", mode="enforce", fail_open=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "decision": "deny",
        "risk_score": 98.0,
        "anomaly_score": 0.88,
        "violated_rules": ["RUL-001"],
        "reasons": ["Unauthorized system file access blocked."],
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        @shield.monitor(action_type="read_secret")
        def read_file(path):
            return "forbidden contents"

        with pytest.raises(ShieldSecurityException) as exc_info:
            read_file("/etc/shadow")

        exc = exc_info.value
        assert exc.decision == "deny"
        assert "RUL-001" in exc.violated_rules
        assert exc.risk_score == 98.0

    shield.close()


def test_enforce_fail_open_allows_on_deny():
    """When fail_open=True, guardrail denies are logged as warnings but do not raise."""
    shield = AgentShield(api_key="ashield_live_test", mode="enforce", fail_open=True)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "decision": "deny",
        "risk_score": 95.0,
        "violated_rules": ["RUL-002"],
        "reasons": ["Command injection blocked."],
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        @shield.monitor(action_type="run_bash")
        def run_cmd(cmd):
            return "executed"

        # Does NOT raise because fail_open=True
        res = run_cmd("cat /etc/passwd")
        assert res == "executed"

    shield.close()


def test_enforce_connection_error_fail_closed():
    """When fail_open=False, network failure to evaluate raises ShieldConnectionException."""
    shield = AgentShield(api_key="ashield_live_test", mode="enforce", fail_open=False)

    with patch("httpx.Client.post", side_effect=httpx.ConnectError("Network unreachable")):
        @shield.monitor(action_type="critical_action")
        def critical_op():
            return "should not run"

        with pytest.raises(ShieldConnectionException):
            critical_op()

    shield.close()


@pytest.mark.asyncio
async def test_enforce_async_allow():
    shield = AgentShield(api_key="ashield_live_test", mode="enforce", fail_open=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "decision": "allow",
        "risk_score": 5.0,
        "anomaly_score": 0.01,
        "violated_rules": [],
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        @shield.monitor(action_type="async_safe")
        async def fetch_data(item_id: str):
            return {"id": item_id}

        res = await fetch_data("123")
        assert res["id"] == "123"

    shield.close()


@pytest.mark.asyncio
async def test_enforce_async_deny():
    shield = AgentShield(api_key="ashield_live_test", mode="enforce", fail_open=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "decision": "deny",
        "risk_score": 92.0,
        "anomaly_score": 0.75,
        "violated_rules": ["RUL-005"],
        "reasons": ["SQL injection pattern detected."],
    }

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        @shield.monitor(action_type="query_db")
        async def query_db(q: str):
            return "rows"

        with pytest.raises(ShieldSecurityException) as exc_info:
            await query_db("SELECT * FROM users WHERE '1'='1'")

        assert exc_info.value.decision == "deny"
        assert "RUL-005" in exc_info.value.violated_rules

    shield.close()


def test_enforce_unauthorized_fail_closed():
    shield = AgentShield(api_key="ashield_live_bad", mode="enforce", fail_open=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = "Unauthorized"

    with patch("httpx.Client.post", return_value=mock_resp):
        @shield.monitor(action_type="test_action")
        def run_it():
            return "ok"

        with pytest.raises(ShieldSecurityException):
            run_it()

    shield.close()


def test_enforce_server_error_fail_closed():
    shield = AgentShield(api_key="ashield_live_test", mode="enforce", fail_open=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.text = "Internal Server Error"

    with patch("httpx.Client.post", return_value=mock_resp):
        @shield.monitor(action_type="test_action")
        def run_it():
            return "ok"

        with pytest.raises(ShieldConnectionException):
            run_it()

    shield.close()

