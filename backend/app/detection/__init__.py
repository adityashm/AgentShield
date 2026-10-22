"""
backend/app/detection — Threat Detection Package.
Normalization, AST DSL rules engine, taxonomy, feature engineering, and Isolation Forest ML.
"""

from .normalize import normalize_text, normalize_payload
from .dsl import SafeASTEvaluator, calculate_entropy
from .rules_engine import RulesEngine, SEVERITY_WEIGHTS
from .features import FeatureExtractor, calculate_shannon_entropy
from .ml import HierarchicalMLEngine, CalibratedIsolationForest, hierarchical_ml_engine

__all__ = [
    "normalize_text",
    "normalize_payload",
    "SafeASTEvaluator",
    "calculate_entropy",
    "RulesEngine",
    "SEVERITY_WEIGHTS",
    "FeatureExtractor",
    "calculate_shannon_entropy",
    "HierarchicalMLEngine",
    "CalibratedIsolationForest",
    "hierarchical_ml_engine",
]
