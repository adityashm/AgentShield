"""
backend/app/api/v1/audit.py — Audit Log and Chain Verification Endpoints.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from datetime import datetime

from ...database import get_db
from ...core.deps import get_current_user
from ...db.models.user import User
from ...services.audit import AuditService

router = APIRouter(tags=["audit"])


class AuditLogResponse(BaseModel):
    id: str
    org_id: str
    ts: datetime
    actor_type: str
    actor_id: str
    action: str
    target_type: str
    target_id: str
    ip: Optional[str]
    details: Dict[str, Any]
    prev_hash: str
    hash: str

    model_config = ConfigDict(from_attributes=True)


class AuditChainVerifyResponse(BaseModel):
    verified: bool
    total_records: int
    latest_hash: Optional[str] = None
    tampered_at_index: Optional[int] = None
    tampered_at_id: Optional[str] = None
    reason: Optional[str] = None
    message: Optional[str] = None


@router.get("/audit", response_model=List[AuditLogResponse])
@router.get("/audit-log", response_model=List[AuditLogResponse])
def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: Optional[str] = None,
    actor_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves paginated audit log events for the current organization."""
    entries, _ = AuditService.get_logs(
        db=db,
        org_id=current_user.org_id,
        limit=limit,
        offset=offset,
        action=action,
        actor_id=actor_id,
    )
    return entries


@router.get("/audit/verify", response_model=AuditChainVerifyResponse)
@router.get("/audit-log/verify", response_model=AuditChainVerifyResponse)
def verify_audit_chain(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cryptographically verifies the unbroken SHA-256 hash chain of all audit events
    for the caller's organization. Detects any record tampering, omission, or reordering.
    """
    result = AuditService.verify_chain(db=db, org_id=current_user.org_id)
    return result
