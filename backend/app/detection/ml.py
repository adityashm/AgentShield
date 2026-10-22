"""
backend/app/detection/ml.py — Hierarchical Isolation Forest Anomaly Detection.
Provides calibrated empirical anomaly scoring with fallback hierarchy:
Agent-specific model -> Org-level model -> Global baseline model.
"""

import os
import math
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import numpy as np
from sklearn.ensemble import IsolationForest

from .features import FeatureExtractor, calculate_shannon_entropy
from ..core.config import settings

logger = logging.getLogger("agentshield.detection.ml")

class CalibratedIsolationForest:
    """Wrapper around IsolationForest maintaining calibration quantiles for empirical scoring."""

    def __init__(self, model: IsolationForest, p50: float = -0.38, p99: float = -0.62):
        self.model = model
        self.p50 = p50
        self.p99 = p99

    def score(self, vector: np.ndarray) -> float:
        """
        Computes calibrated anomaly score in [0.0, 1.0].
        Scores > 0.70 represent anomalies beyond the 99th percentile of normal baseline.
        """
        raw_score = float(self.model.score_samples(vector)[0])
        # Calibrate relative to p50 (median) and p99 (tail threshold)
        if raw_score >= self.p50:
            # Below median anomaly -> between 0.0 and 0.45
            normalized = max(0.0, 0.45 * (self.p50 - raw_score) / (self.p50 + 0.001))
        elif raw_score >= self.p99:
            # Between median and 99th percentile -> [0.45, 0.70]
            fraction = (self.p50 - raw_score) / (self.p50 - self.p99)
            normalized = 0.45 + (0.25 * fraction)
        else:
            # Beyond 99th percentile -> [0.70, 1.0]
            extra = (self.p99 - raw_score) / abs(self.p99)
            normalized = min(1.0, 0.70 + (0.30 * min(1.0, extra * 2.5)))

        return round(float(np.clip(normalized, 0.0, 1.0)), 4)

class HierarchicalMLEngine:
    """Manages baseline and hierarchical tenant/agent Isolation Forest models."""

    def __init__(self):
        self.feature_set: str = settings.ML_FEATURE_SET
        self.n_estimators: int = 100
        self.contamination: float = 0.05
        self.global_model: Optional[CalibratedIsolationForest] = None
        self._agent_models: Dict[str, CalibratedIsolationForest] = {}
        self._org_models: Dict[str, CalibratedIsolationForest] = {}
        self.is_trained: bool = False
        self._initialize_baseline_model()

    def _initialize_baseline_model(self):
        """Train global baseline model on representative synthetic normal actions."""
        np.random.seed(42)
        normal_samples: List[List[float]] = []
        for _ in range(500):
            action_code = float(np.random.choice([1, 2, 3, 4, 5, 8, 9, 10]))  # Benign action codes
            param_count = float(np.random.randint(1, 6))
            call_freq = float(np.random.uniform(5, 45))                      # 5-45 calls/min
            session_dur = float(np.random.uniform(10, 3600))                 # 10s to 1 hour
            time_of_day = float(np.random.uniform(0.0, 1.0))

            if self.feature_set == "v1":
                normal_samples.append([action_code, param_count, call_freq, session_dur, time_of_day])
            else:
                param_size = float(param_count * np.random.uniform(20, 80))
                entropy = float(np.random.uniform(2.5, 3.8))
                error_rate = 0.0
                tool_div = float(np.random.randint(1, 4))
                normal_samples.append([
                    action_code, param_count, param_size, call_freq, session_dur,
                    time_of_day, entropy, error_rate, tool_div
                ])

        X = np.array(normal_samples)
        raw_model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=42,
        )
        raw_model.fit(X)

        # Calibrate quantiles on training data
        scores = raw_model.score_samples(X)
        p50 = float(np.percentile(scores, 50))
        p99 = float(np.percentile(scores, 1))  # lower raw score = higher anomaly

        self.global_model = CalibratedIsolationForest(raw_model, p50=p50, p99=p99)
        self.is_trained = True
        logger.info(f"Initialized global Isolation Forest baseline model (p50={p50:.3f}, p99={p99:.3f}).")

    def extract_features(self, action_data: Dict[str, Any]) -> List[float]:
        """Extracts feature vector using the configured feature set (v1 or v2)."""
        return FeatureExtractor.extract_features(action_data, feature_set=self.feature_set)

    def _get_model_for_action(
        self,
        agent_id: Optional[str] = None,
        org_id: Optional[str] = None,
    ) -> CalibratedIsolationForest:
        """Resolves model in hierarchical order: Agent -> Organization -> Global Baseline."""
        if agent_id and agent_id in self._agent_models:
            return self._agent_models[agent_id]
        if org_id and org_id in self._org_models:
            return self._org_models[org_id]
        if not self.global_model:
            self._initialize_baseline_model()
        return self.global_model  # type: ignore

    def predict_anomaly_score(
        self,
        action_data: Dict[str, Any],
        agent_id: Optional[str] = None,
        org_id: Optional[str] = None,
    ) -> float:
        """
        Computes calibrated anomaly score in range [0.0, 1.0].
        Values > 0.70 indicate high behavioral anomaly.
        """
        vector = np.array([self.extract_features(action_data)])
        model = self._get_model_for_action(agent_id=agent_id, org_id=org_id)
        return model.score(vector)

    def retrain(
        self,
        action_records: List[Dict[str, Any]],
        target_type: str = "global",
        target_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrains Isolation Forest model for agent, org, or global baseline.
        """
        if len(action_records) < 10:
            self._initialize_baseline_model()
            return {
                "status": "baseline_seeded",
                "sample_count": 500,
                "n_estimators": self.n_estimators,
                "contamination": self.contamination,
            }

        vectors = [self.extract_features(record) for record in action_records]
        X = np.array(vectors)

        raw_model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=42,
        )
        raw_model.fit(X)
        scores = raw_model.score_samples(X)
        p50 = float(np.percentile(scores, 50))
        p99 = float(np.percentile(scores, 1))

        calibrated = CalibratedIsolationForest(raw_model, p50=p50, p99=p99)

        if target_type == "agent" and target_id:
            self._agent_models[target_id] = calibrated
        elif target_type == "org" and target_id:
            self._org_models[target_id] = calibrated
        else:
            self.global_model = calibrated
            self.is_trained = True

        return {
            "status": "retrained_successfully",
            "target_type": target_type,
            "target_id": target_id,
            "sample_count": len(vectors),
            "n_estimators": self.n_estimators,
            "contamination": self.contamination,
            "p50": round(p50, 4),
            "p99": round(p99, 4),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

# Global singleton engine instance
hierarchical_ml_engine = HierarchicalMLEngine()
