class ShieldException(Exception):
    """Base exception for all AgentShield SDK errors."""
    pass

class ShieldSecurityException(ShieldException):
    """Raised when an action is blocked by an AgentShield security policy or guardrail."""
    def __init__(self, message: str, decision: str = "deny", violated_rules: list = None, risk_score: float = 0.0):
        super().__init__(message)
        self.decision = decision
        self.violated_rules = violated_rules or []
        self.risk_score = risk_score

class ShieldConnectionException(ShieldException):
    """Raised when the AgentShield ingestion server cannot be reached."""
    pass
