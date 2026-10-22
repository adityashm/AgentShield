from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ...database import get_db
from ...db.models import User
from ...core.deps import get_current_user, require_role
from ...core.security import hash_password, validate_password_strength
from ...core.errors import NotFoundError, ConflictError, ProblemException

router = APIRouter(prefix="/users", tags=["Users Management"])

class UserCreate(BaseModel):
    email: str
    password: str
    role: str = "analyst"  # admin, analyst, viewer

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    org_id: str

@router.get("", response_model=List[UserOut])
def list_org_users(
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.org_id == current_user.org_id).all()
    return [
        UserOut(
            id=u.id,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            org_id=u.org_id,
        )
        for u in users
    ]

@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_org_user(
    req: UserCreate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    if not validate_password_strength(req.password):
        raise ProblemException(
            status_code=400,
            title="Weak Password",
            detail="Password must be at least 12 characters long.",
        )

    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise ConflictError(f"User with email '{req.email}' already exists.")

    new_user = User(
        org_id=current_user.org_id,
        email=req.email.lower(),
        password_hash=hash_password(req.password),
        role=req.role.lower(),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserOut(
        id=new_user.id,
        email=new_user.email,
        role=new_user.role,
        is_active=new_user.is_active,
        org_id=new_user.org_id,
    )

@router.patch("/{user_id}", response_model=UserOut)
def update_org_user(
    user_id: str,
    req: UserUpdate,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.org_id == current_user.org_id).first()
    if not user:
        raise NotFoundError("User not found in your organization.")

    if req.role is not None:
        user.role = req.role.lower()
    if req.is_active is not None:
        user.is_active = req.is_active

    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        org_id=user.org_id,
    )

@router.delete("/{user_id}")
def delete_org_user(
    user_id: str,
    current_user: User = Depends(require_role(["admin"])),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.org_id == current_user.org_id).first()
    if not user:
        raise NotFoundError("User not found in your organization.")

    if user.id == current_user.id:
        raise ProblemException(
            status_code=400,
            title="Self-Deletion Prohibited",
            detail="Administrators cannot delete their own active account.",
        )

    db.delete(user)
    db.commit()
    return {"status": "deleted", "user_id": user_id}
