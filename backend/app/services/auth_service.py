from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    TokenValidationError,
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from app.models.session import UserSession
from app.models.user import User
from app.schemas.auth import RegisterRequest


class InvalidCredentialsError(Exception):
    pass


class InactiveUserError(Exception):
    pass


class UserAlreadyExistsError(Exception):
    pass


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        settings.ACCESS_COOKIE_NAME,
        access_token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh_token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        settings.CSRF_COOKIE_NAME,
        csrf_token,
        httponly=False,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(settings.ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path="/")
    response.delete_cookie(settings.CSRF_COOKIE_NAME, path="/")


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def register(self, payload: RegisterRequest) -> User:
        email = payload.email.lower().strip()
        username = payload.username.strip()
        existing = self.db.scalar(
            select(User).where((User.email == email) | (User.username == username))
        )
        if existing:
            raise UserAlreadyExistsError("Email or username already exists")

        password_hash, password_salt = hash_password(payload.password)
        user = User(
            email=email,
            username=username,
            password_hash=password_hash,
            password_salt=password_salt,
            role=payload.role,
            ship_id=payload.ship_id if payload.role == "crew" else None,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def authenticate(self, email_or_username: str, password: str) -> User:
        identifier = email_or_username.strip()
        user = self.db.scalar(
            select(User).where((User.email == identifier.lower()) | (User.username == identifier))
        )
        if not user or not verify_password(password, user.password_hash, user.password_salt):
            raise InvalidCredentialsError("Invalid credentials")
        if not user.is_active:
            raise InactiveUserError("User account is inactive")
        return user

    def issue_session(self, user: User, response: Response, user_agent: Optional[str], ip_address: Optional[str]) -> None:
        jti = secrets.token_urlsafe(32)
        access_token = create_access_token(str(user.id), user.role)
        refresh_token = create_refresh_token(str(user.id), user.role, jti)
        self.db.add(
            UserSession(
                user_id=user.id,
                jti=jti,
                user_agent=user_agent,
                ip_address=ip_address,
                expires_at=datetime.now(timezone.utc).replace(tzinfo=None)
                + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES),
            )
        )
        self.db.commit()
        set_auth_cookies(response, access_token, refresh_token)

    def rotate_refresh_session(self, refresh_token: str, response: Response, user_agent: Optional[str], ip_address: Optional[str]) -> User:
        try:
            payload = verify_refresh_token(refresh_token)
        except TokenValidationError as exc:
            raise InvalidCredentialsError("Invalid refresh token") from exc

        session = self.db.scalar(
            select(UserSession).where(
                UserSession.jti == payload["jti"],
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > datetime.utcnow(),
            )
        )
        user = self.db.get(User, int(payload["sub"])) if session else None
        if not session or not user or not user.is_active or user.role != payload.get("role"):
            raise InvalidCredentialsError("Invalid refresh token")

        session.revoked_at = datetime.utcnow()
        self.db.flush()
        self.issue_session(user, response, user_agent, ip_address)
        return user

    def logout(self, refresh_token: Optional[str], response: Response) -> None:
        if refresh_token:
            try:
                payload = verify_refresh_token(refresh_token)
                session = self.db.scalar(select(UserSession).where(UserSession.jti == payload["jti"]))
                if session and session.revoked_at is None:
                    session.revoked_at = datetime.utcnow()
                    self.db.commit()
            except TokenValidationError:
                pass
        clear_auth_cookies(response)

    def logout_all(self, user: User, response: Response) -> None:
        self.db.query(UserSession).filter(
            UserSession.user_id == user.id,
            UserSession.revoked_at.is_(None),
        ).update({"revoked_at": datetime.utcnow()}, synchronize_session=False)
        self.db.commit()
        clear_auth_cookies(response)
