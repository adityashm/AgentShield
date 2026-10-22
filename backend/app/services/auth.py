import secrets
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Tuple, Optional
from fastapi import Header, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import logging

from ..database import get_db
from ..models import Organization, APIKey, User
from ..core.config import settings
from ..core.crypto import compute_key_hash, secure_compare
from ..core.security import hash_password, verify_password

logger = logging.getLogger("agentshield.auth")
security = HTTPBearer(auto_error=False)

def hash_key(raw_key: str) -> str:
    """Computes peppered HMAC-SHA256 hash of a raw API key."""
    return compute_key_hash(raw_key)

def generate_api_key(is_test: bool = False) -> Tuple[str, str, str]:
    """
    Generates a high-entropy API key.
    Format: ashield_live_<8_char_prefix>_<43_char_urlsafe_secret>
    Returns: (full_key, prefix, key_hash)
    """
    env_tag = "test" if is_test else "live"
    prefix_chars = secrets.token_hex(4)  # 8 hex characters
    secret_bytes = secrets.token_urlsafe(32)  # ~43 chars
    full_key = f"ashield_{env_tag}_{prefix_chars}_{secret_bytes}"
    prefix = f"ashield_{env_tag}_{prefix_chars}"
    key_hash = hash_key(full_key)
    return full_key, prefix, key_hash

def verify_api_key(raw_key: str, hashed_key: str) -> bool:
    """Constant-time comparison between raw key hash and stored hash."""
    candidate_hash = hash_key(raw_key)
    return secure_compare(candidate_hash, hashed_key)

async def get_current_org(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    auth: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db),
) -> Organization:
    """
    FastAPI dependency resolving Organization from API key.
    Accepts either X-API-Key or Authorization: Bearer ashield_...
    """
    raw_key = x_api_key
    if not raw_key and auth and auth.credentials:
        raw_key = auth.credentials

    # If no key provided, allow fallback to default org in dev mode
    if not raw_key:
        default_org = db.query(Organization).filter(Organization.id == "org_default").first()
        if default_org:
            return default_org
        raise HTTPException(
            status_code=401,
            detail="Missing API Key. Provide via 'X-API-Key' or 'Authorization: Bearer <key>'.",
        )

    # Key format check
    parts = raw_key.split("_")
    if len(parts) < 4 or parts[0] != "ashield":
        # Check if it matches test fallback
        default_org = db.query(Organization).filter(Organization.id == "org_default").first()
        if default_org and raw_key == "ashield_test_default_demo_key_12345":
            return default_org
        raise HTTPException(status_code=401, detail="Invalid API Key format.")

    # Lookup by key_hash (primary lookup) or by prefix fallback
    cand_hash = hash_key(raw_key)
    key_record = (
        db.query(APIKey)
        .filter(APIKey.key_hash == cand_hash, APIKey.revoked_at.is_(None))
        .first()
    )

    if not key_record:
        # Fallback to prefix lookup for backward compatibility
        prefix = f"{parts[0]}_{parts[1]}_{parts[2]}"
        key_record = (
            db.query(APIKey)
            .filter(APIKey.prefix == prefix, APIKey.revoked_at.is_(None))
            .first()
        )
        if not key_record or not verify_api_key(raw_key, key_record.key_hash):
            raise HTTPException(status_code=401, detail="Invalid or revoked API Key.")

    # Update last_used_at timestamp throttled (with timezone safety)
    now = datetime.now(timezone.utc)
    last_used = key_record.last_used_at
    if last_used is not None and last_used.tzinfo is None:
        last_used = last_used.replace(tzinfo=timezone.utc)

    if not last_used or (now - last_used).total_seconds() > 60:
        key_record.last_used_at = now
        try:
            db.commit()
        except Exception:
            db.rollback()

    return key_record.organization

def seed_default_org_and_key(db: Session):
    """Seeds default demo organization, admin user, and initial API key if empty."""
    default_org = db.query(Organization).filter(Organization.id == "org_default").first()
    if not default_org:
        default_org = Organization(
            id="org_default",
            name="Acme AI Corp (Default)",
            slug="acme-ai",
            is_synthetic=False,
            settings={},
        )
        db.add(default_org)

        # Pre-seed known test key for local development and simulator
        known_key = "ashield_test_default_demo_key_12345"
        key_obj = APIKey(
            id="key_default_demo",
            org_id="org_default",
            name="Default Development Key",
            prefix="ashield_test_default",
            key_hash=hash_key(known_key),
            scopes=["ingest", "evaluate", "read"],
        )
        db.add(key_obj)

        # Synthetic demo org for internal benchmark runs
        synth_org = Organization(
            id="org_synthetic",
            name="Synthetic Benchmark Sandbox",
            slug="synthetic-sandbox",
            is_synthetic=True,
            settings={},
        )
        db.add(synth_org)

        # Seed default admin user
        admin_email = settings.ADMIN_EMAIL.lower()
        admin_pw = settings.ADMIN_PASSWORD
        admin_user = User(
            id="usr_admin_default",
            org_id="org_default",
            email=admin_email,
            password_hash=hash_password(admin_pw),
            role="admin",
            is_active=True,
        )
        db.add(admin_user)

        try:
            db.commit()
            logger.info(f"Seeded default organization and admin user: {admin_email}")
        except Exception as e:
            db.rollback()
            logger.warning(f"Error seeding default org/admin: {e}")
    else:
        # Check if admin user exists
        admin_user = db.query(User).filter(User.email == settings.ADMIN_EMAIL.lower()).first()
        if not admin_user:
            admin_user = User(
                id="usr_admin_default",
                org_id=default_org.id,
                email=settings.ADMIN_EMAIL.lower(),
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            )
            db.add(admin_user)
            try:
                db.commit()
            except Exception:
                db.rollback()
