from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from ...database import get_db
from ...schemas import RuleResponse, RuleCreate
from ...models import Rule

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
