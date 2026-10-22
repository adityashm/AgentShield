"""
AgentShield AI — Runtime Behaviour Monitoring and Guardrail SDK for Autonomous AI Agents.
"""

from .client import AgentShield
from .context import session, AgentShieldSession
from .models import ActionPayload, EvaluationResult, PingResponse
from .exceptions import (
    AgentShieldException,
    ShieldSecurityException,
    ShieldConnectionException,
    ShieldConfigurationException,
)
from .redaction import redact_secrets, redact_string
from .integrations.langchain import AgentShieldCallbackHandler
from .integrations.crewai import CrewAIShieldListener
from .integrations.openai import OpenAIAgentShield

__version__ = "1.0.0"

__all__ = [
    "AgentShield",
    "AgentShieldSession",
    "session",
    "ActionPayload",
    "EvaluationResult",
    "PingResponse",
    "AgentShieldException",
    "ShieldSecurityException",
    "ShieldConnectionException",
    "ShieldConfigurationException",
    "redact_secrets",
    "redact_string",
    "AgentShieldCallbackHandler",
    "CrewAIShieldListener",
    "OpenAIAgentShield",
]
