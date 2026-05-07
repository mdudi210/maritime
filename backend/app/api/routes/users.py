from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role, verify_csrf
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import RegisterRequest, UserSummary
from app.services.auth_service import AuthService, UserAlreadyExistsError

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserSummary)
def me(current_user: User = Depends(get_current_user)) -> UserSummary:
    return UserSummary.model_validate(current_user)


@router.get("", response_model=list[UserSummary])
def list_users(
    role: Optional[str] = None,
    ship_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> list[User]:
    query = select(User).order_by(User.username)
    if role:
        query = query.where(User.role == role)
    if ship_id:
        query = query.where(User.ship_id == ship_id)
    return db.scalars(query).all()


@router.post("", response_model=UserSummary, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_csrf)])
def create_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> UserSummary:
    try:
        user = AuthService(db).register(payload)
    except UserAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return UserSummary.model_validate(user)
