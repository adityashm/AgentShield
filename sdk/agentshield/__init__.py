"""
AgentShield AI Python SDK
Real-time security monitoring, behavioural telemetry, and MITRE ATLAS guardrails for AI Agents.
"""

from .client import AgentShield
from .exceptions import ShieldSecurityException, ShieldConnectionException
from .langchain_callback import AgentShieldCallbackHandler

__all__ = [
    "AgentShield",
    "AgentShieldCallbackHandler",
    "ShieldSecurityException",
    "ShieldConnectionException",
]

__version__ = "1.0.0"
