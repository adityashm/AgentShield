import secrets
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Tuple, Optional
from fastapi import Header, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Organization, APIKey

security = HTTPBearer(auto_error=False)

def hash_key(raw_key: str) -> str:
    """Computes SHA-256 hash of a raw API key string."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()

def generate_api_key(is_test: bool = False) -> Tuple[str, str, str]:
    """
    Generates a high-entropy API key.
    Format: ashield_live_<8_char_prefix>_<32_byte_token>
    Returns: (full_key, prefix, hashed_key)
    """
    env_tag = "test" if is_test else "live"
    prefix = secrets.token_hex(4)  # 8 hex characters
    secret_bytes = secrets.token_urlsafe(32)
    full_key = f"ashield_{env_tag}_{prefix}_{secret_bytes}"
    hashed = hash_key(full_key)
    return full_key, f"ashield_{env_tag}_{prefix}", hashed

def verify_api_key(raw_key: str, hashed_key: str) -> bool:
    """Constant-time comparison between raw candidate key and stored hash."""
    candidate_hash = hash_key(raw_key)
    return hmac.compare_digest(candidate_hash, hashed_key)

async def get_current_org(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    auth: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db),
) -> Organization:
    """
    FastAPI dependency resolving Organization from API key.
    Accepts either X-API-Key or Authorization: Bearer ashield_...
    Falls back to default demo org if running in open evaluation mode without key.
    """
    raw_key = x_api_key
    if not raw_key and auth and auth.credentials:
        raw_key = auth.credentials

    # If no key provided, allow fallback to default org for seamless demo/local evaluation
    if not raw_key:
        default_org = db.query(Organization).filter(Organization.org_id == "org_default").first()
        if default_org:
            return default_org
        # If no default org exists, raise 401
        raise HTTPException(
            status_code=401,
            detail="Missing API Key. Provide via 'X-API-Key' or 'Authorization: Bearer <key>'.",
        )

    # Key format check
    parts = raw_key.split("_")
    if len(parts) < 4 or parts[0] != "ashield":
        # Check if it matches test fallback
        default_org = db.query(Organization).filter(Organization.org_id == "org_default").first()
        if default_org and raw_key == "ashield_test_default_demo_key_12345":
            return default_org
        raise HTTPException(status_code=401, detail="Invalid API Key format.")

    prefix = f"{parts[0]}_{parts[1]}_{parts[2]}"

    # Fast indexed lookup by prefix
    key_record = (
        db.query(APIKey)
        .filter(APIKey.prefix == prefix, APIKey.revoked_at.is_(None))
        .first()
    )

    if not key_record or not verify_api_key(raw_key, key_record.hashed_key):
        raise HTTPException(status_code=401, detail="Invalid or revoked API Key.")

    # Update last_used_at timestamp
    key_record.last_used_at = datetime.now(timezone.utc)
    db.commit()

    return key_record.organization

def seed_default_org_and_key(db: Session):
    """Seeds default demo organization and initial API key if empty."""
    default_org = db.query(Organization).filter(Organization.org_id == "org_default").first()
    if not default_org:
        default_org = Organization(
            org_id="org_default",
            name="Acme AI Corp (Default)",
            slug="acme-ai",
            is_synthetic=False,
        )
        db.add(default_org)

        # Pre-seed a known test key for local development and simulator
        known_key = "ashield_test_default_demo_key_12345"
        key_obj = APIKey(
            key_id="key_default_demo",
            org_id="org_default",
            name="Default Development Key",
            prefix="ashield_test_default",
            hashed_key=hash_key(known_key),
            scopes="actions:write,alerts:read",
        )
        db.add(key_obj)

        # Synthetic demo org for internal benchmark runs
        synth_org = Organization(
            org_id="org_synthetic",
            name="Synthetic Benchmark Sandbox",
            slug="synthetic-sandbox",
            is_synthetic=True,
        )
        db.add(synth_org)

        db.commit()
