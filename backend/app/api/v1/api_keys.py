from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from ...database import get_db
from ...models import Organization, APIKey
from ...services.auth import generate_api_key, get_current_org

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

class KeyCreateRequest(BaseModel):
    name: str
    is_test: bool = False
    scopes: str = "actions:write,alerts:read"

class KeyCreateResponse(BaseModel):
    key_id: str
    name: str
    prefix: str
    api_key: str  # Only returned once upon creation!
    scopes: str
    created_at: datetime

class KeyListItem(BaseModel):
    key_id: str
    name: str
    prefix: str
    scopes: str
    created_at: datetime
    last_used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None

@router.post("", response_model=KeyCreateResponse)
def create_api_key(
    req: KeyCreateRequest,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db),
):
    """Generate a new enterprise API key for agent cluster ingestion. Raw key is returned only once."""
    full_key, prefix, hashed = generate_api_key(is_test=req.is_test)

    key_record = APIKey(
        org_id=org.org_id,
        name=req.name,
        prefix=prefix,
        hashed_key=hashed,
        scopes=req.scopes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(key_record)
    db.commit()
    db.refresh(key_record)

    return KeyCreateResponse(
        key_id=key_record.key_id,
        name=key_record.name,
        prefix=key_record.prefix,
        api_key=full_key,
        scopes=key_record.scopes,
        created_at=key_record.created_at,
    )

@router.get("", response_model=List[KeyListItem])
def list_api_keys(
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db),
):
    """List all API keys for the current organization."""
    keys = (
        db.query(APIKey)
        .filter(APIKey.org_id == org.org_id)
        .order_by(APIKey.created_at.desc())
        .all()
    )
    return [
        KeyListItem(
            key_id=k.key_id,
            name=k.name,
            prefix=k.prefix,
            scopes=k.scopes,
            created_at=k.created_at,
            last_used_at=k.last_used_at,
            revoked_at=k.revoked_at,
        )
        for k in keys
    ]

@router.delete("/{key_id}")
def revoke_api_key(
    key_id: str,
    org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db),
):
    """Revoke an API key immediately."""
    key_record = (
        db.query(APIKey)
        .filter(APIKey.key_id == key_id, APIKey.org_id == org.org_id)
        .first()
    )
    if not key_record:
        raise HTTPException(status_code=404, detail="API Key not found.")

    key_record.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "revoked", "key_id": key_id}
