"""
backend/app/services/risk_calculator.py — Re-export for backward compatibility.
"""

from .scoring import RiskCalculator, RiskScoringService

__all__ = ["RiskCalculator", "RiskScoringService"]
