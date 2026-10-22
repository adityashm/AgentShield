"""
agentshield.exceptions — Custom exceptions for AgentShield SDK.
"""

from typing import List, Optional, Dict, Any


class AgentShieldException(Exception):
    """Base exception for all AgentShield errors."""
    pass


class ShieldSecurityException(AgentShieldException):
    """
    Raised when an agent action is blocked by a security policy rule or anomalous behaviour
    in 'enforce' mode (and fail_open=False).
    """

    def __init__(
        self,
        message: str = "Action blocked by AgentShield security guardrail.",
        decision: str = "deny",
        violated_rules: Optional[List[str]] = None,
        risk_score: float = 100.0,
        reasons: Optional[List[str]] = None,
        action_type: Optional[str] = None,
        agent_id: Optional[str] = None,
    ):
        super().__init__(message)
        self.message = message
        self.decision = decision
        self.violated_rules = violated_rules or []
        self.risk_score = risk_score
        self.reasons = reasons or []
        self.action_type = action_type
        self.agent_id = agent_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": "ShieldSecurityException",
            "message": self.message,
            "decision": self.decision,
            "violated_rules": self.violated_rules,
            "risk_score": self.risk_score,
            "reasons": self.reasons,
            "action_type": self.action_type,
            "agent_id": self.agent_id,
        }


class ShieldConnectionException(AgentShieldException):
    """
    Raised when communication with the AgentShield backend fails or times out
    in 'enforce' mode (and fail_open=False).
    """
    pass


class ShieldConfigurationException(AgentShieldException):
    """Raised when the SDK is misconfigured (e.g. invalid API key format, missing endpoint)."""
    pass
