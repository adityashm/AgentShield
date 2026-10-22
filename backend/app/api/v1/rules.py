from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import json
import uuid

from ...database import get_db
from ...schemas import RuleResponse, RuleCreate
from ...models import Rule, User
from ...detection.dsl import SafeASTEvaluator
from ...detection.normalize import normalize_payload
from ...services.audit import AuditService
from ...core.deps import get_current_user, get_optional_user

router = APIRouter(prefix="/rules", tags=["rules"])

RULE_PROFILES = {
    "fintech": {
        "id": "fintech",
        "name": "FinTech & Banking",
        "badge": "SOC 2 / PCI-DSS",
        "icon": "account_balance",
        "description": "Strict SQL exfiltration controls, PII redaction, high-entropy secret token shielding, and zero-tolerance database access policies.",
        "active_rules": ["RUL-001", "RUL-004", "RUL-005", "RUL-008", "RUL-014", "RUL-020"],
        "enforcement_mode": "enforce",
        "block_threshold": 70.0,
    },
    "healthcare": {
        "id": "healthcare",
        "name": "Healthcare & Life Sciences",
        "badge": "HIPAA / HITECH",
        "icon": "local_hospital",
        "description": "Clinical PHI redaction, patient data isolation, medical prompt injection defense, and non-repudiation audit logging.",
        "active_rules": ["RUL-001", "RUL-003", "RUL-005", "RUL-007", "RUL-012", "RUL-015"],
        "enforcement_mode": "enforce",
        "block_threshold": 75.0,
    },
    "customer_support": {
        "id": "customer_support",
        "name": "Customer Support & Public Bots",
        "badge": "OWASP ASI 2026",
        "icon": "support_agent",
        "description": "Anti-jailbreak guardrails, prompt deflection against social engineering, token burst rate limiting, and brand safety boundaries.",
        "active_rules": ["RUL-002", "RUL-003", "RUL-007", "RUL-017", "RUL-018"],
        "enforcement_mode": "enforce",
        "block_threshold": 80.0,
    },
    "devops": {
        "id": "devops",
        "name": "DevOps & Cloud Infrastructure",
        "badge": "ISO 27001",
        "icon": "cloud_done",
        "description": "Host bash execution blocking, AWS metadata SSRF (169.254.169.254) blocking, root privilege escalation prevention, and container escape defense.",
        "active_rules": ["RUL-001", "RUL-004", "RUL-006", "RUL-008", "RUL-014", "RUL-016", "RUL-019"],
        "enforcement_mode": "enforce",
        "block_threshold": 70.0,
    },
    "balanced": {
        "id": "balanced",
        "name": "Enterprise Balanced",
        "badge": "Standard 20-Rule Baseline",
        "icon": "shield",
        "description": "Comprehensive protection across all OWASP Top 10 for Agentic Applications categories with balanced sensitivity to minimize false positives.",
        "active_rules": [
            "RUL-001", "RUL-002", "RUL-003", "RUL-004", "RUL-005",
            "RUL-006", "RUL-007", "RUL-008", "RUL-009", "RUL-010",
            "RUL-011", "RUL-012", "RUL-013", "RUL-014", "RUL-015",
            "RUL-016", "RUL-017", "RUL-018", "RUL-019", "RUL-020",
        ],
        "enforcement_mode": "enforce",
        "block_threshold": 80.0,
    },
}

class ProfileApplyRequest(BaseModel):
    profile_id: str
    mode: Optional[str] = "enforce"

class ProfileApplyResponse(BaseModel):
    profile_id: str
    profile_name: str
    rules_enabled: int
    rules_disabled: int
    total_rules: int
    active_rule_ids: List[str]
    audit_hash: str


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

@router.get("/profiles")
def get_rule_profiles():
    """Retrieve pre-built 1-click industry policy profiles."""
    return list(RULE_PROFILES.values())

@router.post("/profiles/apply", response_model=ProfileApplyResponse)
def apply_rule_profile(
    body: ProfileApplyRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Applies the selected industry guardrail profile to the tenant's ruleset
    and records an immutable audit ledger entry.
    """
    p_id = body.profile_id.strip().lower()
    if p_id not in RULE_PROFILES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown profile '{body.profile_id}'. Valid options: {list(RULE_PROFILES.keys())}"
        )
    profile = RULE_PROFILES[p_id]
    target_rule_ids = set(profile["active_rules"])
    org_id = current_user.org_id if (current_user and hasattr(current_user, "org_id")) else "org_default"

    all_rules = db.query(Rule).filter((Rule.org_id == org_id) | (Rule.org_id.is_(None))).all()
    if not all_rules:
        from ...detection.rules_engine import RulesEngine
        RulesEngine.seed_default_rules(db, org_id=org_id)
        all_rules = db.query(Rule).filter((Rule.org_id == org_id) | (Rule.org_id.is_(None))).all()

    enabled_count = 0
    disabled_count = 0
    active_ids = []

    for rule in all_rules:
        r_id = rule.rule_id or rule.id
        if p_id == "balanced" or r_id in target_rule_ids:
            rule.enabled = True
            enabled_count += 1
            active_ids.append(r_id)
        else:
            rule.enabled = False
            disabled_count += 1

    db.commit()

    # Append immutable event to Cryptographic Audit Ledger
    audit_entry = AuditService.log_event(
        db=db,
        org_id=org_id,
        action=f"rules.profile.applied.{p_id}",
        target_type="ruleset",
        target_id=p_id,
        actor_type="web_console",
        actor_id=current_user.email if current_user else "admin_user",
        details={
            "profile": p_id,
            "profile_name": profile["name"],
            "rules_enabled": enabled_count,
            "rules_disabled": disabled_count,
            "active_rules": active_ids,
        },
    )
    db.commit()

    return ProfileApplyResponse(
        profile_id=p_id,
        profile_name=profile["name"],
        rules_enabled=enabled_count,
        rules_disabled=disabled_count,
        total_rules=len(all_rules),
        active_rule_ids=active_ids,
        audit_hash=audit_entry.hash,
    )


