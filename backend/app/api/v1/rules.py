from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json
import uuid

from ...database import get_db
from ...schemas import RuleResponse, RuleCreate
from ...models import Rule
from ...detection.dsl import SafeASTEvaluator
from ...detection.normalize import normalize_payload

router = APIRouter(prefix="/rules", tags=["rules"])

@router.get("", response_model=List[RuleResponse])
def list_rules(db: Session = Depends(get_db)):
    """List all configured security rules (SRS FR-08)."""
    return db.query(Rule).order_by(Rule.rule_id.asc()).all()

@router.post("", response_model=RuleResponse)
def create_rule(rule_in: RuleCreate, db: Session = Depends(get_db)):
    """Create a new security rule without restarting the service (SRS FR-08)."""
    next_num = db.query(Rule).count() + 1
    rule_id = f"RUL-{next_num:03d}"
    rule = Rule(
        rule_id=rule_id,
        name=rule_in.name,
        description=rule_in.description,
        category=rule_in.category,
        severity=rule_in.severity,
        condition_json=rule_in.condition_json,
        enabled=rule_in.enabled,
        matches_count=0,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/{rule_id}")
def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    """Delete a security rule by ID."""
    rule = db.query(Rule).filter(Rule.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "deleted", "rule_id": rule_id}

@router.patch("/{rule_id}/toggle")
def toggle_rule(rule_id: str, db: Session = Depends(get_db)):
    """Toggle a rule between active and disabled."""
    rule = db.query(Rule).filter(Rule.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.enabled = not rule.enabled
    db.commit()
    return {"rule_id": rule_id, "enabled": rule.enabled}

@router.post("/test")
def test_rule(body: Dict[str, Any] = Body(...)):
    """Evaluate a JSON-DSL condition against a sample payload using Safe AST."""
    condition = body.get("condition")
    payload = body.get("payload", {})
    if isinstance(condition, str):
        try:
            condition = json.loads(condition)
        except Exception:
            pass
    normalized = normalize_payload(payload) if isinstance(payload, dict) else payload
    try:
        matched = SafeASTEvaluator.evaluate(condition, normalized)
    except Exception as e:
        return {
            "matched": False,
            "decision": "error",
            "reasons": [f"Evaluation error: {str(e)}"],
        }
    return {
        "matched": bool(matched),
        "decision": "deny" if matched else "allow",
        "reasons": [
            "Rule condition matched test payload (Security Policy Violation Detected)"
            if matched
            else "Rule condition did not match test payload (Action Permitted)"
        ],
    }

