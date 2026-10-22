from typing import List
from sqlalchemy.orm import Session
from ..models import Action, Agent

class RiskCalculator:
    """Calculates per-action and rolling per-agent risk scores (SRS FR-16 to FR-19)."""

    @staticmethod
    def calculate_action_risk(rule_severity_score: float, anomaly_score: float) -> float:
        """
        Risk Score formula (SRS FR-16):
        Risk Score = (0.4 * Rule Severity Score) + (0.6 * Anomaly Score * 100)
        Normalized to [0.0, 100.0]
        """
        # anomaly_score is [0, 1], multiplied by 100 to scale to [0, 100]
        weighted_score = (0.4 * rule_severity_score) + (0.6 * (anomaly_score * 100.0))
        clamped_score = max(0.0, min(100.0, weighted_score))
        return round(clamped_score, 1)

    @staticmethod
    def update_agent_rolling_risk(agent_id: str, db: Session) -> float:
        """
        Calculates rolling per-agent risk score as the weighted average
        of the agent's last 20 action risk scores (SRS FR-17).
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

        # Exponential recency weighting for the 20 actions
        scores = [a.risk_score for a in last_actions]
        weights = [1.0 / (i + 1) for i in range(len(scores))]
        total_weight = sum(weights)
        rolling_score = sum(s * w for s, w in zip(scores, weights)) / total_weight
        rolling_score = round(max(0.0, min(100.0, rolling_score)), 1)

        # Update Agent model
        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        if agent:
            agent.current_risk_score = rolling_score
            db.commit()

        return rolling_score

    @staticmethod
    def classify_risk_band(score: float) -> str:
        """Classify risk into four bands (SRS FR-19)."""
        if score <= 25.0:
            return "Safe"
        elif score <= 50.0:
            return "Low Risk"
        elif score <= 75.0:
            return "Medium Risk"
        else:
            return "High Risk"
