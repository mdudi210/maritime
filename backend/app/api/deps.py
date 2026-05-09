from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import APIKeyCookie, APIKeyHeader
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TokenValidationError, verify_access_token
from app.models.user import User


access_token_cookie = APIKeyCookie(name=settings.ACCESS_COOKIE_NAME, auto_error=False)
csrf_cookie = APIKeyCookie(name=settings.CSRF_COOKIE_NAME, auto_error=False)
csrf_header = APIKeyHeader(name=settings.CSRF_HEADER_NAME, auto_error=False)


async def verify_csrf(
    request: Request,
    csrf_cookie_value: Optional[str] = Security(csrf_cookie),
    csrf_header_value: Optional[str] = Security(csrf_header),
) -> None:
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return
    if not csrf_cookie_value or not csrf_header_value or csrf_cookie_value != csrf_header_value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")


def get_current_user(
    db: Session = Depends(get_db),
    access_token: Optional[str] = Security(access_token_cookie),
) -> User:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing access token")
    try:
        payload = verify_access_token(access_token)
    except TokenValidationError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")

    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active or user.role != payload.get("role"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")
    return user


def require_role(*roles: str):
    allowed = {role.lower() for role in roles}

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.password_reset_required:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password reset required")
        if current_user.role.lower() not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return dependency


def require_password_ready(current_user: User = Depends(get_current_user)) -> User:
    if current_user.password_reset_required:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Password reset required")
    return current_user
