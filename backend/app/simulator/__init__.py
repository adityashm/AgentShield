"""
AgentShield AI — Simulator Module
"""

from .scenarios import (
    SIMULATED_AGENTS,
    NORMAL_ACTIONS,
    THREAT_SCENARIOS,
    get_scenario,
    generate_random_action,
    generate_batch,
)
from .client import SimulatorClient, DEFAULT_BASE_URL, DEFAULT_DEMO_API_KEY
from .cli import run_cli

__all__ = [
    "SIMULATED_AGENTS",
    "NORMAL_ACTIONS",
    "THREAT_SCENARIOS",
    "get_scenario",
    "generate_random_action",
    "generate_batch",
    "SimulatorClient",
    "DEFAULT_BASE_URL",
    "DEFAULT_DEMO_API_KEY",
    "run_cli",
]
