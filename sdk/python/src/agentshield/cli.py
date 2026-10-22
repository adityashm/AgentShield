"""
agentshield.cli — Command-Line Interface for AgentShield.
Provides connectivity diagnostics (ping) and test event generation.
"""

import sys
import os
import argparse
import json
from .client import AgentShield
from .exceptions import AgentShieldException

try:
    from rich.console import Console
    from rich.table import Table
    console = Console()
except ImportError:
    console = None


def print_success(msg: str):
    if console:
        console.print(f"[bold green]✓[/bold green] {msg}")
    else:
        print(f"[SUCCESS] {msg}")


def print_error(msg: str):
    if console:
        console.print(f"[bold red]✗[/bold red] {msg}")
    else:
        print(f"[ERROR] {msg}")


def cmd_ping(args):
    api_key = args.api_key or os.getenv("AGENTSHIELD_API_KEY")
    endpoint = args.endpoint or os.getenv("AGENTSHIELD_ENDPOINT") or "http://localhost:8000/api/v1"

    if not api_key:
        print_error("Missing API key. Pass --api-key or set AGENTSHIELD_API_KEY environment variable.")
        sys.exit(1)

    try:
        shield = AgentShield(api_key=api_key, endpoint=endpoint)
        res = shield.ping()
        print_success(f"AgentShield backend is ONLINE at {endpoint}")
        print(f"  Organization : {res.organization}")
        print(f"  Key Prefix   : {res.key_prefix}")
        print(f"  Scopes       : {', '.join(res.scopes)}")
        shield.close()
    except Exception as exc:
        print_error(f"Failed to connect to AgentShield: {exc}")
        sys.exit(1)


def cmd_send_test_event(args):
    api_key = args.api_key or os.getenv("AGENTSHIELD_API_KEY")
    endpoint = args.endpoint or os.getenv("AGENTSHIELD_ENDPOINT") or "http://localhost:8000/api/v1"
    agent_id = args.agent_id or "cli_diagnostic_agent"
    action_type = args.action_type or "cli_diagnostic_action"

    if not api_key:
        print_error("Missing API key. Pass --api-key or set AGENTSHIELD_API_KEY.")
        sys.exit(1)

    try:
        params = json.loads(args.parameters) if args.parameters else {"test": True, "source": "agentshield_cli"}
    except Exception:
        params = {"raw_params": args.parameters}

    try:
        shield = AgentShield(api_key=api_key, endpoint=endpoint)
        shield.log_action(agent_id=agent_id, action_type=action_type, parameters=params)
        shield.flush()
        shield.close()
        print_success(f"Dispatched test action '{action_type}' for agent '{agent_id}' to {endpoint}.")
    except Exception as exc:
        print_error(f"Failed to dispatch test event: {exc}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="AgentShield AI — Command Line Interface")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # ping
    ping_parser = subparsers.add_parser("ping", help="Test connectivity to AgentShield backend")
    ping_parser.add_argument("--api-key", help="AgentShield API Key")
    ping_parser.add_argument("--endpoint", help="AgentShield API Endpoint URL")

    # send-test-event
    event_parser = subparsers.add_parser("send-test-event", help="Send a test action telemetry event")
    event_parser.add_argument("--api-key", help="AgentShield API Key")
    event_parser.add_argument("--endpoint", help="AgentShield API Endpoint URL")
    event_parser.add_argument("--agent-id", default="cli_diagnostic_agent", help="Agent identifier")
    event_parser.add_argument("--action-type", default="cli_diagnostic_action", help="Action type")
    event_parser.add_argument("--parameters", help="JSON string parameters")

    args = parser.parse_args()
    if args.command == "ping":
        cmd_ping(args)
    elif args.command == "send-test-event":
        cmd_send_test_event(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
