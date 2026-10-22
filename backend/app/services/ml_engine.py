import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

# Action type dictionary mapping for numerical vectorization
ACTION_TYPE_MAP = {
    "heartbeat_ok": 1,
    "data_sync": 2,
    "status_query": 3,
    "file_read": 4,
    "file_write": 5,
    "database_query": 6,
    "prompt_execution": 7,
    "api_call": 8,
    "api_burst_flood": 9,
    "unauthorized_access": 10,
    "privilege_escalation": 11,
    "data_exfiltration": 12,
    "unsafe_command": 13,
}

class MLEngine:
    """Scikit-learn Isolation Forest ML engine for agent behavioural anomaly detection."""

    def __init__(self):
        self.model: Optional[IsolationForest] = None
        self.is_trained: bool = False
        self.contamination: float = 0.05
        self.n_estimators: int = 100
        self._initialize_baseline_model()

    def _initialize_baseline_model(self):
        """Train baseline model with representative synthetic normal action distributions."""
        np.random.seed(42)
        # Generate baseline normal action features:
        # [action_type_code, param_count, call_frequency, session_duration, time_of_day]
        normal_samples = []
        for _ in range(500):
            action_code = np.random.choice([1, 2, 3, 4, 8])  # normal types
            param_count = np.random.randint(1, 6)
            call_freq = np.random.uniform(5, 45)             # 5-45 calls/min
            session_dur = np.random.uniform(10, 3600)        # 10s to 1 hour
            time_of_day = np.random.uniform(0.0, 1.0)
            normal_samples.append([action_code, param_count, call_freq, session_dur, time_of_day])

        X = np.array(normal_samples)
        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=42,
        )
        self.model.fit(X)
        self.is_trained = True

    def extract_features(self, action_data: Dict[str, Any]) -> List[float]:
        """
        Extract 5-dimensional feature vector (SRS FR-11):
        [action_type_encoded, parameter_count, call_frequency, session_duration, time_of_day]
        """
        action_type = str(action_data.get("action_type", "")).lower()
        action_code = float(ACTION_TYPE_MAP.get(action_type, 14))

        params = action_data.get("parameters", {})
        param_count = float(len(params) if isinstance(params, dict) else 1)

        # Approximate call frequency (default 20 calls/min unless specified)
        call_frequency = float(action_data.get("call_frequency", 20.0))

        # Approximate session duration
        session_duration = float(action_data.get("session_duration", 120.0))

        # Normalized time of day [0.0, 1.0]
        now = datetime.now(timezone.utc)
        time_of_day = float((now.hour * 3600 + now.minute * 60 + now.second) / 86400.0)

        return [action_code, param_count, call_frequency, session_duration, time_of_day]

    def predict_anomaly_score(self, action_data: Dict[str, Any]) -> float:
        """
        Computes normalized anomaly score in range [0.0, 1.0] (SRS FR-13).
        Values > 0.7 indicate anomalous behaviour.
        """
        if not self.model:
            self._initialize_baseline_model()

        vector = np.array([self.extract_features(action_data)])
        
        # score_samples returns the opposite of the anomaly score (lower is more anomalous)
        # Typically in range [-0.7, 0.0] for IsolationForest
        raw_score = self.model.score_samples(vector)[0]
        
        # Map raw score [-0.7, 0.0] to [1.0, 0.0] normalized
        normalized_score = float(np.clip((0.0 - raw_score) / 0.65, 0.0, 1.0))
        return round(normalized_score, 4)

    def retrain(self, action_records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Retrain Isolation Forest model on historical action records (SRS FR-14).
        """
        if len(action_records) < 10:
            # Fallback to re-seeding baseline if not enough data
            self._initialize_baseline_model()
            return {
                "status": "baseline_seeded",
                "sample_count": 500,
                "n_estimators": self.n_estimators,
                "contamination": self.contamination,
            }

        vectors = [self.extract_features(record) for record in action_records]
        X = np.array(vectors)

        new_model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=42,
        )
        new_model.fit(X)
        self.model = new_model
        self.is_trained = True

        return {
            "status": "retrained_successfully",
            "sample_count": len(vectors),
            "n_estimators": self.n_estimators,
            "contamination": self.contamination,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

ml_engine = MLEngine()
