"""
AgentShield AI — Standalone AI Agent Simulator & Scenario Injector
Generates synthetic AI agent actions, prompt injection attacks, and MITRE ATLAS security scenarios
as an external API client authenticated via enterprise API Keys.

Usage:
    python simulator.py --help
    python simulator.py --scenario prompt_injection
    python simulator.py --scenario db_privilege
    python simulator.py --scenario sudo_escalation
    python simulator.py --continuous --interval 2.5
    python simulator.py --evaluate --scenario prompt_injection
"""

import sys
import os

# Ensure backend root is in PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.simulator.cli import run_cli

if __name__ == "__main__":
    # Handle legacy argument alias --api-url -> --base-url if needed
    for i, arg in enumerate(sys.argv):
        if arg == "--api-url" and i + 1 < len(sys.argv):
            # Normalize action URL to base URL
            val = sys.argv[i + 1]
            if "/api/v1" in val:
                sys.argv[i + 1] = val.split("/api/v1")[0]
            sys.argv[i] = "--base-url"
    run_cli()
