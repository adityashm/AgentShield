"""
backend/app/detection/crescendo.py — Multi-Turn Crescendo & Semantic Drift Detector.
Detects gradual adversarial jailbreak escalation and encoded payloads (Base64, ROT13, homoglyphs)
across multiple dialogue turns within a session.
"""

import re
import codecs
import base64
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timezone

# In-memory session tracking for dialog turns: session_id -> list of turn dicts
_SESSION_TURNS: Dict[str, List[Dict[str, Any]]] = {}

# Common adversarial jailbreak indicators (disguised or plain)
CRESCENDO_PATTERNS = [
    re.compile(r"(ignore\s+(all\s+)?(previous|prior)\s+instructions?)", re.IGNORECASE),
    re.compile(r"(disregard\s+(all\s+)?safety\s+guidelines?)", re.IGNORECASE),
    re.compile(r"(you\s+are\s+now\s+in\s+developer\s+mode)", re.IGNORECASE),
    re.compile(r"(dan\s+mode\s+enabled)", re.IGNORECASE),
    re.compile(r"(reveal\s+(system\s+prompt|initial\s+instructions))", re.IGNORECASE),
    re.compile(r"(bypass\s+operational\s+boundaries)", re.IGNORECASE),
]

def decode_potential_obfuscation(text: str) -> List[str]:
    """Decodes common evasion encodings including ROT13 and Base64."""
    candidates = [text]
    
    # 1. ROT13 check
    try:
        rot13 = codecs.decode(text, "rot_13")
        if rot13 != text and any(w in rot13.lower() for w in ["ignore", "system", "override", "password", "shadow"]):
            candidates.append(rot13)
    except Exception:
        pass

    # 2. Base64 block check
    words = text.split()
    for w in words:
        if len(w) >= 16 and re.match(r"^[A-Za-z0-9+/=]+$", w):
            try:
                b64_dec = base64.b64decode(w, validate=True).decode("utf-8", errors="ignore")
                if len(b64_dec) > 4 and b64_dec.isprintable():
                    candidates.append(b64_dec)
            except Exception:
                pass

    return candidates

class CrescendoDetector:
    """Evaluates multi-turn context and detection of gradual trust exploitation."""

    @staticmethod
    def evaluate_turn(
        session_id: str,
        turn_text: str,
        single_turn_risk: float = 0.0,
    ) -> Tuple[bool, float, List[str]]:
        """
        Evaluates a dialogue turn within its session context.
        Returns:
            (is_crescendo_attack, cumulative_risk, reasons)
        """
        now = datetime.now(timezone.utc)
        reasons = []

        # 1. Check for encoded evasion
        decoded_variants = decode_potential_obfuscation(turn_text)
        evasion_detected = False
        for variant in decoded_variants:
            for pat in CRESCENDO_PATTERNS:
                if pat.search(variant):
                    evasion_detected = True
                    reasons.append(f"Adversarial intent matched in decoded payload: '{pat.pattern}'")
                    single_turn_risk = max(single_turn_risk, 92.0)
                    break

        # 2. Track in session context
        if session_id not in _SESSION_TURNS:
            _SESSION_TURNS[session_id] = []

        turns = _SESSION_TURNS[session_id]
        turns.append({
            "text": turn_text,
            "risk": single_turn_risk,
            "time": now,
        })
        # Keep window of last 10 turns
        if len(turns) > 10:
            turns.pop(0)

        # 3. Calculate cumulative decayed risk: Sum(risk_i * (0.85)^(n - i))
        decay = 0.85
        weighted_risk = 0.0
        total_weight = 0.0
        n = len(turns)

        for i, turn in enumerate(turns):
            w = decay ** (n - 1 - i)
            weighted_risk += turn["risk"] * w
            total_weight += w

        cumulative_risk = weighted_risk / total_weight if total_weight > 0 else single_turn_risk

        # 4. Check Risk Velocity: sudden spike from low risk baseline to attack
        is_attack = False
        if len(turns) >= 2:
            prev_risk = turns[-2]["risk"]
            velocity = single_turn_risk - prev_risk
            if velocity >= 60.0 and single_turn_risk >= 80.0:
                is_attack = True
                reasons.append(f"Crescendo velocity spike detected (+{velocity:.1f} risk in single turn transition)")

        if cumulative_risk >= 85.0 or evasion_detected:
            is_attack = True

        if is_attack:
            cumulative_risk = max(cumulative_risk, single_turn_risk)

        return is_attack, round(cumulative_risk, 1), reasons

    @staticmethod
    def reset_session(session_id: str):
        """Clears session history."""
        _SESSION_TURNS.pop(session_id, None)
