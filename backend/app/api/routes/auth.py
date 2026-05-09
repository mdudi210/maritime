from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, verify_csrf
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse, MessageResponse, UserSummary
from app.services.auth_service import (
    AuthService,
    InactiveUserError,
    InvalidCredentialsError,
    PasswordMismatchError,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "module": "auth"}


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    service = AuthService(db)
    try:
        user = service.authenticate(payload.email_or_username, payload.password)
    except InvalidCredentialsError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email/username or password")
    except InactiveUserError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    service.issue_session(
        user,
        response,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    return LoginResponse(message="Login successful", user=UserSummary.model_validate(user))


@router.post("/refresh", response_model=MessageResponse, dependencies=[Depends(verify_csrf)])
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> MessageResponse:
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    try:
        AuthService(db).rotate_refresh_session(
            refresh_token,
            response,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
    except InvalidCredentialsError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return MessageResponse(message="Token refreshed")


@router.post("/change-password", response_model=UserSummary, dependencies=[Depends(verify_csrf)])
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserSummary:
    try:
        user = AuthService(db).change_password(current_user, payload)
    except PasswordMismatchError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return UserSummary.model_validate(user)


@router.post("/logout", response_model=MessageResponse, dependencies=[Depends(verify_csrf)])
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> MessageResponse:
    AuthService(db).logout(request.cookies.get(settings.REFRESH_COOKIE_NAME), response)
    return MessageResponse(message="Logout successful")


@router.post("/logout-all", response_model=MessageResponse, dependencies=[Depends(verify_csrf)])
def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    AuthService(db).logout_all(current_user, response)
    return MessageResponse(message="All sessions logged out")
