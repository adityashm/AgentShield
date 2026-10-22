from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ...database import get_db
from ...db.models import User, RefreshToken, Organization, AuditLog
from ...core.config import settings
from ...core.security import (
    verify_password,
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
)
from ...core.ratelimit import login_limiter
from ...core.errors import RateLimitExceededError, UnauthorizedError, ProblemException
from ...core.deps import get_current_user

router = APIRouter(tags=["Authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    org_id: str
    org_name: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

@router.post("/auth/login", response_model=TokenResponse)
def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "127.0.0.1"
    rate_key = f"{req.email.lower()}:{client_ip}"
    
    # 5 failures per 15 min limit
    failures = login_limiter.get_failure_count(rate_key, window_seconds=900)
    if failures >= 5:
        raise RateLimitExceededError(
            detail="Too many failed login attempts. Account temporarily locked for 15 minutes.",
            retry_after=900,
        )

    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        login_limiter.record_failure(rate_key, window_seconds=900)
        raise UnauthorizedError("Invalid email or password.")

    if not user.is_active:
        raise UnauthorizedError("User account is inactive. Please contact an administrator.")

    # Successful login: clear failures
    login_limiter.clear(rate_key)
    user.last_login_at = datetime.now(timezone.utc)
    user.failed_logins = 0

    # Issue JWT access token
    access_token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "org_id": user.org_id,
    })

    # Issue and store refresh token
    raw_refresh, token_hash = generate_refresh_token()
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_DAYS),
        user_agent=request.headers.get("User-Agent", "")[:255],
        ip=client_ip,
    )
    db.add(refresh_record)
    db.commit()

    # Set secure HttpOnly cookie
    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        samesite="strict",
        secure=is_prod,
        max_age=settings.REFRESH_DAYS * 86400,
        path="/",
    )

    org = db.query(Organization).filter(Organization.id == user.org_id).first()
    org_name = org.name if org else "Default Org"

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_MINUTES * 60,
        user=UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            org_id=user.org_id,
            org_name=org_name,
        ),
    )

@router.post("/auth/refresh", response_model=TokenResponse)
def refresh_token_endpoint(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    raw_refresh = request.cookies.get("refresh_token")
    if not raw_refresh:
        raise UnauthorizedError("Refresh token missing.")

    token_hash = hash_refresh_token(raw_refresh)
    token_rec = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
        .first()
    )

    if not token_rec or not token_rec.is_active:
        raise UnauthorizedError("Invalid or expired refresh token.")

    user = token_rec.user
    if not user or not user.is_active:
        raise UnauthorizedError("User is inactive.")

    # Rotate refresh token: revoke current and issue new
    new_raw_refresh, new_token_hash = generate_refresh_token()
    token_rec.revoked_at = datetime.now(timezone.utc)
    token_rec.replaced_by = new_token_hash

    new_token_rec = RefreshToken(
        user_id=user.id,
        token_hash=new_token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_DAYS),
        user_agent=request.headers.get("User-Agent", "")[:255],
        ip=request.client.host if request.client else "127.0.0.1",
    )
    db.add(new_token_rec)
    db.commit()

    # Set rotated cookie
    is_prod = settings.ENVIRONMENT.lower() == "production"
    response.set_cookie(
        key="refresh_token",
        value=new_raw_refresh,
        httponly=True,
        samesite="strict",
        secure=is_prod,
        max_age=settings.REFRESH_DAYS * 86400,
        path="/",
    )

    access_token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "org_id": user.org_id,
    })

    org = db.query(Organization).filter(Organization.id == user.org_id).first()
    org_name = org.name if org else "Default Org"

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_MINUTES * 60,
        user=UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            org_id=user.org_id,
            org_name=org_name,
        ),
    )

@router.post("/auth/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    raw_refresh = request.cookies.get("refresh_token")
    if raw_refresh:
        token_hash = hash_refresh_token(raw_refresh)
        token_rec = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
        if token_rec:
            token_rec.revoked_at = datetime.now(timezone.utc)
            db.commit()

    response.delete_cookie("refresh_token", path="/")
    return {"status": "logged_out", "detail": "Session revoked successfully."}

@router.get("/auth/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        org_id=current_user.org_id,
        org_name=org.name if org else "Default Org",
    )

@router.get("/meta")
def get_system_meta():
    return {
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "demo_mode": settings.DEMO_MODE,
        "simulator_enabled": settings.SIMULATOR_ENABLED,
    }
