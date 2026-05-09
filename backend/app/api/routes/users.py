from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role, verify_csrf
from app.core.database import get_db
from app.models.ship import Ship
from app.models.drill import DrillParticipation
from app.models.session import UserSession
from app.models.user import User
from app.schemas.auth import AdminPasswordResetRequest, ProfileUpdateRequest, RegisterRequest, UserSummary, UserUpdateRequest
from app.services.auth_service import AuthService, UserAlreadyExistsError

router = APIRouter(prefix="/users", tags=["users"])


def _summarize_user(db: Session, user: User) -> UserSummary:
    summary = UserSummary.model_validate(user)
    summary.last_login_at = db.scalar(select(func.max(UserSession.created_at)).where(UserSession.user_id == user.id))
    summary.total_drills_assigned = db.scalar(
        select(func.count()).select_from(DrillParticipation).where(DrillParticipation.user_id == user.id)
    ) or 0
    summary.total_drills_completed = db.scalar(
        select(func.count())
        .select_from(DrillParticipation)
        .where(DrillParticipation.user_id == user.id, DrillParticipation.attendance.is_(True))
    ) or 0
    return summary


def _admin_count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.is_active.is_(True))) or 0


@router.get("/me", response_model=UserSummary)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserSummary:
    return _summarize_user(db, current_user)


@router.patch("/me", response_model=UserSummary, dependencies=[Depends(verify_csrf)])
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserSummary:
    if payload.username:
        username = payload.username.strip()
        existing = db.scalar(select(User).where(User.username == username, User.id != current_user.id))
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
        current_user.username = username
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return _summarize_user(db, current_user)


@router.get("", response_model=list[UserSummary])
def list_users(
    role: Optional[str] = None,
    ship_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> list[UserSummary]:
    query = select(User).order_by(User.username)
    if not current_user.all_ships:
        query = query.where(
            or_(
                User.id == current_user.id,
                (User.role == "crew") & (User.ship_id == current_user.ship_id),
            )
        )
    if role:
        query = query.where(User.role == role)
    if ship_id:
        query = query.where(or_(User.ship_id == ship_id, (User.role == "crew") & (User.all_ships.is_(True))))
    return [_summarize_user(db, user) for user in db.scalars(query).all()]


@router.post("", response_model=UserSummary, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_csrf)])
def create_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> UserSummary:
    if payload.role == "admin" and not _.all_ships:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admin accounts can create Admin accounts")
    if not _.all_ships:
        if payload.role != "crew":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins can only create Crew accounts")
        if payload.all_ships or payload.ship_id != _.ship_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins can only assign users to their ship")
    if payload.ship_id and not db.get(Ship, payload.ship_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ship not found")
    try:
        user = AuthService(db).register(payload)
    except UserAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _summarize_user(db, user)


@router.post("/{user_id}/reset-password", response_model=UserSummary, dependencies=[Depends(verify_csrf)])
def reset_user_password(
    user_id: int,
    payload: AdminPasswordResetRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
) -> UserSummary:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user = AuthService(db).reset_password(user, payload.temporary_password)
    return _summarize_user(db, user)


@router.patch("/{user_id}", response_model=UserSummary, dependencies=[Depends(verify_csrf)])
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> UserSummary:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.role and user.id == current_user.id and payload.role != current_user.role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own admin role")
    if user.role == "admin" and payload.role == "crew" and _admin_count(db) <= 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot demote the last active Admin account")
    if user.role == "admin" and payload.is_active is False and _admin_count(db) <= 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate the last active Admin account")
    if user.role == "admin" and user.id != current_user.id and not current_user.all_ships:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admin accounts can manage Admin accounts")
    if not current_user.all_ships:
        if user.role != "crew" or user.ship_id != current_user.ship_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        if payload.role and payload.role != "crew":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins cannot create or promote Admin accounts")
        if payload.all_ships or (payload.ship_id is not None and payload.ship_id != current_user.ship_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins can only assign users to their ship")
    if payload.ship_id and not db.get(Ship, payload.ship_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ship not found")
    if payload.email:
        email = payload.email.lower().strip()
        existing = db.scalar(select(User).where(User.email == email, User.id != user.id))
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
        user.email = email
    if payload.username:
        username = payload.username.strip()
        existing = db.scalar(select(User).where(User.username == username, User.id != user.id))
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
        user.username = username

    if payload.role:
        user.role = payload.role
    if payload.role is not None or payload.ship_id is not None or payload.all_ships is not None:
        if payload.all_ships:
            user.ship_id = None
            user.all_ships = True
        elif payload.ship_id is not None:
            user.ship_id = payload.ship_id
            user.all_ships = False
        elif payload.role == "crew":
            user.all_ships = False
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.add(user)
    if payload.role or payload.ship_id is not None or payload.all_ships is not None or payload.is_active is not None:
        db.query(UserSession).filter(
            UserSession.user_id == user.id,
            UserSession.revoked_at.is_(None),
        ).update({"revoked_at": func.now()}, synchronize_session=False)
    db.commit()
    db.refresh(user)
    return _summarize_user(db, user)
