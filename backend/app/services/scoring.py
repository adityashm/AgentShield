"""
backend/app/services/scoring.py — Composite Risk Scoring Service.
Combines rule violations and Isolation Forest anomaly scores into calibrated risk ratings.
Implements exponential recency rolling window and guardrail block floors.
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from ..db.models import Action, Agent
from ..core.config import settings

class RiskScoringService:
    """Computes instant and rolling risk metrics for actions and agents."""

    @staticmethod
    def calculate_action_risk(
        rule_severity_score: float,
        anomaly_score: float,
        is_blocked: bool = False,
    ) -> float:
        """
        Risk Score formula:
        Risk Score = (0.4 * Rule Score) + (0.6 * Anomaly Score * 100)
        Floor at 90.0 if blocked by a critical guardrail policy.
        """
        rule_weight = getattr(settings, "RISK_WEIGHT_RULE", 0.4)
        anomaly_weight = getattr(settings, "RISK_WEIGHT_ANOMALY", 0.6)

        weighted_score = (rule_weight * rule_severity_score) + (anomaly_weight * (anomaly_score * 100.0))
        if is_blocked:
            weighted_score = max(weighted_score, 90.0)

        clamped = max(0.0, min(100.0, weighted_score))
        return round(clamped, 1)

    @staticmethod
    def update_agent_rolling_risk(agent_id: str, db: Session) -> float:
        """
        Calculates rolling per-agent risk score as the recency-weighted average
        of the agent's last 20 action risk scores.
        """
        last_actions = (
            db.query(Action)
            .filter(Action.agent_id == agent_id)
            .order_by(Action.timestamp.desc())
            .limit(20)
            .all()
        )

        if not last_actions:
            return 0.0

        scores = [a.risk_score for a in last_actions]
        # Exponential recency weighting
        weights = [1.0 / (i + 1) for i in range(len(scores))]
        total_weight = sum(weights)
        rolling_score = sum(s * w for s, w in zip(scores, weights)) / total_weight
        rolling_score = round(max(0.0, min(100.0, rolling_score)), 1)

        # Update Agent model
        agent = db.query(Agent).filter((Agent.id == agent_id) | (Agent.external_id == agent_id)).first()
        if agent:
            agent.current_risk_score = rolling_score
            db.commit()

        return rolling_score

    @staticmethod
    def classify_risk_band(score: float) -> str:
        """Classify numerical risk into operational bands."""
        if score <= 25.0:
            return "Safe"
        elif score <= 50.0:
            return "Low Risk"
        elif score <= 75.0:
            return "Medium Risk"
        else:
            return "High Risk"

# Alias for backward compatibility
RiskCalculator = RiskScoringService
