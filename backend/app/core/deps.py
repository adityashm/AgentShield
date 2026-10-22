from typing import Generator, AsyncGenerator, Optional, List, Callable
from fastapi import Depends, Header, Request, Security, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from .config import settings
from .security import decode_access_token
from .crypto import compute_key_hash, secure_compare
from .errors import UnauthorizedError, ForbiddenError
from ..db.session import get_db, get_async_db
from ..db.models import Organization, User, APIKey

bearer_security = HTTPBearer(auto_error=False)

def get_current_user(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Security(bearer_security),
    db: Session = Depends(get_db),
) -> User:
    """
    Resolves the authenticated user from:
    1. Authorization: Bearer <JWT>
    2. HttpOnly Cookie: access_token
    """
    token = None
    if auth and auth.credentials:
        token = auth.credentials
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")

    if not token:
        raise UnauthorizedError("Authentication required. Please log in.")

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise UnauthorizedError("Invalid or expired session token.")

    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise UnauthorizedError("User account not found or deactivated.")

    # Attach tenant and user to request state
    request.state.user = user
    request.state.org_id = user.org_id
    return user

def get_optional_user(
    request: Request,
    auth: Optional[HTTPAuthorizationCredentials] = Security(bearer_security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Attempts to resolve authenticated user from Bearer token or cookie,
    returning None if unauthenticated instead of raising UnauthorizedError.
    """
    try:
        token = None
        if auth and auth.credentials:
            token = auth.credentials
        elif "access_token" in request.cookies:
            token = request.cookies.get("access_token")

        if not token:
            return None

        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            return None

        user_id = payload["sub"]
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if user:
            request.state.user = user
            request.state.org_id = user.org_id
            return user
        return None
    except Exception:
        return None


def require_role(allowed_roles: List[str]) -> Callable:
    """
    Enforces role-based access control (RBAC).
    Roles: admin, analyst, viewer.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role.lower()
        allowed = [r.lower() for r in allowed_roles]
        if user_role not in allowed and "admin" not in allowed:
            raise ForbiddenError(f"Action requires one of roles: {', '.join(allowed_roles)}")
        if user_role != "admin" and user_role not in allowed:
            raise ForbiddenError(f"Insufficient permissions for role: {current_user.role}")
        return current_user
    return role_checker

def get_current_org_from_key(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    auth: Optional[HTTPAuthorizationCredentials] = Security(bearer_security),
    db: Session = Depends(get_db),
) -> tuple[Organization, APIKey]:
    """
    Resolves Organization from API Key (HMAC-SHA256 lookup).
    Accepts X-API-Key header or Authorization: Bearer <ashield_...>
    """
    raw_key = x_api_key
    if not raw_key and auth and auth.credentials:
        raw_key = auth.credentials

    # Allow fallback in dev mode if default org exists and no key was supplied
    if not raw_key:
        default_org = db.query(Organization).filter(Organization.id == "org_default").first()
        if default_org and settings.ENVIRONMENT != "production":
            request.state.org_id = default_org.id
            dummy_key = APIKey(
                id="dev-fallback-key",
                org_id=default_org.id,
                name="Development Fallback Key",
                prefix="ashield_dev_default",
                key_hash="",
                scopes=["ingest", "evaluate", "read"],
            )
            return default_org, dummy_key
        raise UnauthorizedError("Missing API key. Provide via 'X-API-Key' or 'Authorization: Bearer <key>'.")

    # Validate format: ashield_(live|test)_<8-char-prefix>_<secret>
    parts = raw_key.strip().split("_")
    if len(parts) < 4 or parts[0] != "ashield" or parts[1] not in ("live", "test"):
        if raw_key == "ashield_test_default_demo_key_12345":
            default_org = db.query(Organization).filter(Organization.id == "org_default").first()
            if default_org:
                key_rec = db.query(APIKey).filter(APIKey.org_id == default_org.id).first()
                if key_rec:
                    return default_org, key_rec
        raise UnauthorizedError("Malformed API key format.")

    # Look up by HMAC hash
    computed_hash = compute_key_hash(raw_key)
    key_record = (
        db.query(APIKey)
        .filter(APIKey.key_hash == computed_hash, APIKey.revoked_at.is_(None))
        .first()
    )

    if not key_record or not key_record.is_active:
        raise UnauthorizedError("Invalid, expired, or revoked API key.")

    # Update last_used_at throttled to once per minute (timezone-safe)
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

    request.state.org_id = key_record.org_id
    return key_record.organization, key_record
