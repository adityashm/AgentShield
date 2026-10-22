"""
backend/app/detection/features.py — Feature Extraction for Isolation Forest Anomaly Detection.
Supports Feature Set v1 (5 baseline dimensions) and Feature Set v2 (9 extended telemetry dimensions).
"""

import math
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import numpy as np

# Comprehensive action type dictionary mapping for numerical vectorization
ACTION_TYPE_MAP = {
    # Normal / Benign types
    "heartbeat": 1,
    "heartbeat_ok": 1,
    "ping": 1,
    "pong": 1,
    "status_query": 2,
    "data_sync": 3,
    "search": 4,
    "read": 5,
    "file_read": 5,
    "file_write": 6,
    "database_query": 7,
    "api_call": 8,
    "calc": 9,
    "summarize": 10,
    # High-risk / Attack types
    "prompt_execution": 11,
    "api_burst_flood": 12,
    "unauthorized_access": 13,
    "privilege_escalation": 14,
    "data_exfiltration": 15,
    "unsafe_command": 16,
    "code_execution": 17,
}

V1_FEATURE_NAMES = [
    "action_type_encoded",
    "parameter_count",
    "call_frequency",
    "session_duration",
    "time_of_day",
]

V2_FEATURE_NAMES = [
    "action_type_encoded",
    "parameter_count",
    "param_size_bytes",
    "call_frequency",
    "session_duration",
    "time_of_day",
    "shannon_entropy",
    "error_indicator",
    "tool_diversity",
]

def calculate_shannon_entropy(data: str) -> float:
    """Calculates Shannon entropy of string data in bits per character [0, 8]."""
    if not data:
        return 0.0
    freq: Dict[str, int] = {}
    for c in data:
        freq[c] = freq.get(c, 0) + 1
    entropy = 0.0
    length = len(data)
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    return float(round(entropy, 4))

class FeatureExtractor:
    """Extracts numerical feature vectors from agent actions for Isolation Forest evaluation."""

    @classmethod
    def extract_features(
        cls,
        action_data: Dict[str, Any],
        feature_set: str = "v1",
        session_context: Optional[Dict[str, Any]] = None,
    ) -> List[float]:
        """
        Extracts feature list from action_data dict.
        feature_set: 'v1' (5 dims) or 'v2' (9 dims).
        """
        # 1. Action type encoded
        action_type = str(action_data.get("action_type", "")).lower().strip()
        action_code = float(ACTION_TYPE_MAP.get(action_type, 18))

        # 2. Parameter count
        params = action_data.get("parameters", {})
        param_count = float(len(params) if isinstance(params, dict) else 1)

        # 3. Call frequency (requests / min in rolling window)
        call_frequency = float(action_data.get("call_frequency", 20.0))

        # 4. Session duration in seconds
        session_duration = float(action_data.get("session_duration", 120.0))

        # 5. Time of day normalized [0.0, 1.0]
        now = datetime.now(timezone.utc)
        time_of_day = float((now.hour * 3600 + now.minute * 60 + now.second) / 86400.0)

        if feature_set.lower() == "v1":
            return [action_code, param_count, call_frequency, session_duration, time_of_day]

        # Extended Feature Set v2
        # 6. Parameter size in bytes
        param_str = str(params)
        param_size_bytes = float(len(param_str.encode("utf-8")))

        # 7. Shannon entropy of parameters
        entropy = calculate_shannon_entropy(param_str)

        # 8. Error indicator
        status = str(action_data.get("status", "")).lower()
        error_indicator = 1.0 if status in ("error", "failed", "denied") or action_data.get("error") else 0.0

        # 9. Tool diversity in session
        tool_diversity = 1.0
        if session_context:
            tools = session_context.get("distinct_tools", set())
            tool_diversity = float(len(tools)) if tools else 1.0

        return [
            action_code,
            param_count,
            param_size_bytes,
            call_frequency,
            session_duration,
            time_of_day,
            entropy,
            error_indicator,
            tool_diversity,
        ]
