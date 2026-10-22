import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Union
from datetime import datetime, timezone, timedelta

from ...database import get_db
from ...db.models import Organization, APIKey, User, AuditLog
from ...services.auth import generate_api_key, hash_key
from ...core.config import settings
from ...core.deps import get_current_user, get_current_org_from_key
from ...core.errors import NotFoundError, ForbiddenError, ProblemException

router = APIRouter(prefix="/api-keys", tags=["API Keys"])

class KeyCreateRequest(BaseModel):
    name: str
    is_test: bool = False
    scopes: Union[List[str], str] = ["ingest", "evaluate", "read"]
    rate_limit_per_minute: Optional[int] = None
    expires_at: Optional[datetime] = None

class KeyCreateResponse(BaseModel):
    key_id: str
    id: str
    name: str
    prefix: str
    api_key: str  # Only returned once upon creation or rotation!
    scopes: Union[List[str], str]
    created_at: str

class KeyListItem(BaseModel):
    key_id: str
    id: str
    name: str
    prefix: str
    scopes: Union[List[str], str]
    created_at: str
    last_used_at: Optional[str] = None
    expires_at: Optional[str] = None
    revoked_at: Optional[str] = None
    is_active: bool

def normalize_scopes(raw_scopes: Union[List[str], str]) -> List[str]:
    if isinstance(raw_scopes, list):
        return [s.strip() for s in raw_scopes if s.strip()]
    if isinstance(raw_scopes, str):
        return [s.strip() for s in raw_scopes.split(",") if s.strip()]
    return ["ingest", "evaluate", "read"]

@router.post("", response_model=KeyCreateResponse)
def create_api_key(
    req: KeyCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Generate a new API key. Raw key is returned only once!
    Accepts dashboard auth (current_user) or API key auth fallback.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    user_id = getattr(getattr(request.state, "user", None), "id", None)

    full_key, prefix, key_hash = generate_api_key(is_test=req.is_test)
    parsed_scopes = normalize_scopes(req.scopes)

    key_id = str(uuid.uuid4())
    key_record = APIKey(
        id=key_id,
        org_id=org_id,
        name=req.name,
        prefix=prefix,
        key_hash=key_hash,
        scopes=parsed_scopes,
        is_test=req.is_test,
        rate_limit_per_minute=req.rate_limit_per_minute or settings.RATE_LIMIT_PER_KEY_PER_MIN,
        created_by_user_id=user_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(key_record)
    db.flush()
    
    # Audit log entry
    audit = AuditLog(
        id=str(uuid.uuid4()),
        org_id=org_id,
        actor_type="user" if user_id else "system",
        actor_id=user_id or "system",
        action="api_key.create",
        target_type="api_key",
        target_id=key_record.id,
        ip=request.client.host if request.client else "127.0.0.1",
        details={"name": req.name, "prefix": prefix, "scopes": parsed_scopes},
        prev_hash="0" * 64,
        hash="0" * 64,
    )
    db.add(audit)
    db.commit()
    db.refresh(key_record)

    return KeyCreateResponse(
        key_id=key_record.id,
        id=key_record.id,
        name=key_record.name,
        prefix=key_record.prefix,
        api_key=full_key,
        scopes=req.scopes,
        created_at=key_record.created_at.isoformat(),
    )

@router.get("", response_model=List[KeyListItem])
def list_api_keys(
    request: Request,
    db: Session = Depends(get_db),
):
    """List all API keys for the current organization."""
    org_id = getattr(request.state, "org_id", "org_default")
    keys = (
        db.query(APIKey)
        .filter(APIKey.org_id == org_id)
        .order_by(APIKey.created_at.desc())
        .all()
    )
    return [
        KeyListItem(
            key_id=k.id,
            id=k.id,
            name=k.name,
            prefix=k.prefix,
            scopes=k.scopes,
            created_at=k.created_at.isoformat() if k.created_at else "",
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            expires_at=k.expires_at.isoformat() if k.expires_at else None,
            revoked_at=k.revoked_at.isoformat() if k.revoked_at else None,
            is_active=k.is_active,
        )
        for k in keys
    ]

@router.post("/{key_id}/rotate", response_model=KeyCreateResponse)
def rotate_api_key(
    key_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Rotate an API key: generates a new key and sets the old key's expiration
    to the grace window (default 24h), then returns the new key once.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    user_id = getattr(getattr(request.state, "user", None), "id", None)

    old_key = (
        db.query(APIKey)
        .filter(APIKey.id == key_id, APIKey.org_id == org_id)
        .first()
    )
    if not old_key:
        raise NotFoundError("API key not found.")

    if not old_key.is_active:
        raise ProblemException(
            status_code=400,
            title="Key Inactive",
            detail="Cannot rotate an expired or revoked API key.",
        )

    # Issue replacement key
    full_new_key, new_prefix, new_hash = generate_api_key(is_test="test" in old_key.prefix)
    new_key_id = str(uuid.uuid4())
    new_key = APIKey(
        id=new_key_id,
        org_id=org_id,
        name=f"{old_key.name} (Rotated)",
        prefix=new_prefix,
        key_hash=new_hash,
        scopes=old_key.scopes,
        is_test=old_key.is_test,
        rate_limit_per_minute=old_key.rate_limit_per_minute,
        created_by_user_id=user_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_key)
    db.flush()

    # Apply grace period to old key
    grace_hours = settings.KEY_ROTATION_GRACE_HOURS
    old_key.expires_at = datetime.now(timezone.utc) + timedelta(hours=grace_hours)
    old_key.replaced_by = new_key.id

    # Audit log
    audit = AuditLog(
        id=str(uuid.uuid4()),
        org_id=org_id,
        actor_type="user" if user_id else "system",
        actor_id=user_id or "system",
        action="api_key.rotate",
        target_type="api_key",
        target_id=old_key.id,
        ip=request.client.host if request.client else "127.0.0.1",
        details={"old_prefix": old_key.prefix, "new_prefix": new_prefix, "grace_hours": grace_hours},
        prev_hash="0" * 64,
        hash="0" * 64,
    )
    db.add(audit)
    db.commit()

    return KeyCreateResponse(
        key_id=new_key.id,
        id=new_key.id,
        name=new_key.name,
        prefix=new_key.prefix,
        api_key=full_new_key,
        scopes=new_key.scopes,
        created_at=new_key.created_at.isoformat(),
    )

@router.delete("/{key_id}")
@router.post("/{key_id}/revoke")
def revoke_api_key(
    key_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Revoke an API key immediately."""
    org_id = getattr(request.state, "org_id", "org_default")
    user_id = getattr(getattr(request.state, "user", None), "id", None)

    key_record = (
        db.query(APIKey)
        .filter(APIKey.id == key_id, APIKey.org_id == org_id)
        .first()
    )
    if not key_record:
        raise NotFoundError("API Key not found.")

    key_record.revoked_at = datetime.now(timezone.utc)

    # Audit log
    audit = AuditLog(
        id=str(uuid.uuid4()),
        org_id=org_id,
        actor_type="user" if user_id else "system",
        actor_id=user_id or "system",
        action="api_key.revoke",
        target_type="api_key",
        target_id=key_record.id,
        ip=request.client.host if request.client else "127.0.0.1",
        details={"name": key_record.name, "prefix": key_record.prefix},
        prev_hash="0" * 64,
        hash="0" * 64,
    )
    db.add(audit)
    db.commit()

    return {"status": "revoked", "key_id": key_id}
