"""
backend/app/detection/rules_engine.py — Rules Evaluation Engine.
Normalizes incoming payload, evaluates AST DSL rules against DB rules and seeded defaults.
"""

import os
import json
import logging
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session

from .dsl import SafeASTEvaluator
from .normalize import normalize_payload
from ..db.models import Rule

logger = logging.getLogger("agentshield.detection.rules")

SEVERITY_WEIGHTS = {
    "CRITICAL": 100.0,
    "HIGH": 75.0,
    "MEDIUM": 50.0,
    "LOW": 25.0,
}

def load_default_rules() -> List[Dict[str, Any]]:
    default_rules_file = os.path.join(os.path.dirname(__file__), "default_rules.json")
    try:
        with open(default_rules_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load default_rules.json: {e}")
        return []

class RulesEngine:
    """Production rule evaluation engine with payload normalization and AST evaluation."""

    @staticmethod
    def evaluate_action(
        action_data: Dict[str, Any],
        db: Session,
        org_id: Optional[str] = None,
    ) -> Tuple[List[Rule], float]:
        """
        Normalizes action payload and evaluates against active DB rules for the organization.
        Returns (list_of_matched_rules, rule_severity_score [0, 100]).
        """
        # 1. Normalize payload to strip evasion/homoglyphs/zero-width chars
        normalized_data = normalize_payload(action_data)

        # 2. Query active rules (organization-scoped + global)
        q = db.query(Rule).filter(Rule.enabled == True)
        if org_id:
            q = q.filter((Rule.org_id == org_id) | (Rule.org_id == "org_default"))
        active_rules = q.all()

        # If database has no rules, fallback to default rules in memory
        if not active_rules:
            RulesEngine.seed_default_rules(db, org_id=org_id or "org_default")
            active_rules = db.query(Rule).filter(Rule.enabled == True).all()

        matched_rules: List[Rule] = []
        max_severity_score = 0.0

        for rule in active_rules:
            # Skip disabled rules or rules explicitly set to mode='disabled'
            if getattr(rule, "mode", "alert") == "disabled":
                continue

            try:
                cond = json.loads(rule.condition_json) if isinstance(rule.condition_json, str) else rule.condition_json
            except Exception:
                continue

            if SafeASTEvaluator.evaluate(cond, normalized_data):
                matched_rules.append(rule)
                rule.matches_count = (rule.matches_count or 0) + 1

                weight = SEVERITY_WEIGHTS.get(str(rule.severity).upper(), 25.0)
                if weight > max_severity_score:
                    max_severity_score = weight

        return matched_rules, max_severity_score

    @staticmethod
    def seed_default_rules(db: Session, org_id: str = "org_default"):
        """Seeds standard 20 security rules into the database if not already present."""
        rules_data = load_default_rules()
        existing_ids = {r.id for r in db.query(Rule.id).all()}

        added = 0
        updated = 0
        for r in rules_data:
            rule_id = r.get("rule_id", r.get("id"))
            cond_str = r["condition_json"] if isinstance(r["condition_json"], str) else json.dumps(r["condition_json"])
            if rule_id not in existing_ids:
                rule = Rule(
                    id=rule_id,
                    org_id=org_id,
                    name=r["name"],
                    description=r.get("description"),
                    category=r.get("category", "Security"),
                    severity=r.get("severity", "MEDIUM"),
                    mode=r.get("mode", "alert"),
                    owasp_id=r.get("owasp_id"),
                    mitre_id=r.get("mitre_id"),
                    condition_json=cond_str,
                    enabled=r.get("enabled", True),
                    matches_count=0,
                )
                db.add(rule)
                added += 1
            else:
                existing_rule = db.query(Rule).filter(Rule.id == rule_id).first()
                if existing_rule:
                    existing_rule.condition_json = cond_str
                    existing_rule.mode = r.get("mode", existing_rule.mode)
                    updated += 1

        if added > 0 or updated > 0:
            db.commit()
            logger.info(f"Seeded {added} new, updated {updated} existing rules in database.")
