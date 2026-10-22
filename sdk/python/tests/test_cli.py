"""
sdk/python/tests/test_cli.py — Unit Tests for AgentShield CLI.
"""

import sys
from unittest.mock import patch, MagicMock
from agentshield.cli import main, cmd_ping, cmd_send_test_event


def test_cli_ping_command():
    mock_args = MagicMock()
    mock_args.api_key = "ashield_live_test"
    mock_args.endpoint = "http://localhost:8000/api/v1"

    with patch("agentshield.client.AgentShield.ping") as mock_ping, \
         patch("agentshield.client.AgentShield.close"):
        mock_ping.return_value = MagicMock(
            organization="Test Org",
            key_prefix="ashield_live_test",
            scopes=["ingest", "evaluate"],
        )
        cmd_ping(mock_args)
        mock_ping.assert_called_once()


def test_cli_send_test_event():
    mock_args = MagicMock()
    mock_args.api_key = "ashield_live_test"
    mock_args.endpoint = "http://localhost:8000/api/v1"
    mock_args.agent_id = "test_agent"
    mock_args.action_type = "test_action"
    mock_args.parameters = '{"foo": "bar"}'

    with patch("agentshield.client.AgentShield.log_action") as mock_log, \
         patch("agentshield.client.AgentShield.flush"), \
         patch("agentshield.client.AgentShield.close"):
        cmd_send_test_event(mock_args)
        mock_log.assert_called_once_with(
            agent_id="test_agent",
            action_type="test_action",
            parameters={"foo": "bar"},
        )


def test_cli_ping_no_key_exits():
    mock_args = MagicMock()
    mock_args.api_key = None
    mock_args.endpoint = None

    with patch.dict("os.environ", {}, clear=True), patch("sys.exit") as mock_exit:
        cmd_ping(mock_args)
        mock_exit.assert_called_with(1)


def test_cli_ping_exception_exits():
    mock_args = MagicMock()
    mock_args.api_key = "ashield_live_test"
    mock_args.endpoint = "http://localhost:8000/api/v1"

    with patch("agentshield.client.AgentShield.ping", side_effect=RuntimeError("Connection refused")), \
         patch("sys.exit") as mock_exit:
        cmd_ping(mock_args)
        mock_exit.assert_called_with(1)


def test_cli_main_help(capsys):
    with patch.object(sys, "argv", ["agentshield"]):
        main()
    captured = capsys.readouterr()
    assert "usage:" in captured.out.lower() or "help" in captured.out.lower()

