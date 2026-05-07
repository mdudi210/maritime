from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from jwt import InvalidTokenError

from app.core.config import settings


ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


class TokenValidationError(Exception):
    pass


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    password_salt = salt or base64.urlsafe_b64encode(os.urandom(24)).decode("utf-8")
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), password_salt.encode("utf-8"), 210_000)
    return base64.urlsafe_b64encode(digest).decode("utf-8"), password_salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    candidate, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate, password_hash)


def _build_token(
    *,
    user_id: str,
    role: str,
    token_type: str,
    expires_in_minutes: int,
    secret: str,
    jti: Optional[str] = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_in_minutes)).timestamp()),
        "jti": jti or base64.urlsafe_b64encode(os.urandom(24)).decode("utf-8"),
    }
    return jwt.encode(payload, secret, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, role: str) -> str:
    return _build_token(
        user_id=user_id,
        role=role,
        token_type=ACCESS_TOKEN_TYPE,
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        secret=settings.JWT_SECRET_KEY,
    )


def create_refresh_token(user_id: str, role: str, jti: str) -> str:
    return _build_token(
        user_id=user_id,
        role=role,
        token_type=REFRESH_TOKEN_TYPE,
        expires_in_minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES,
        secret=settings.JWT_REFRESH_SECRET_KEY,
        jti=jti,
    )


def _decode_token(token: str, secret: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, secret, algorithms=[settings.JWT_ALGORITHM])
    except InvalidTokenError as exc:
        raise TokenValidationError("Invalid token") from exc
    if payload.get("type") != expected_type:
        raise TokenValidationError("Invalid token type")
    if not payload.get("sub") or not payload.get("role") or not payload.get("jti"):
        raise TokenValidationError("Token payload missing required claims")
    return payload


def verify_access_token(token: str) -> dict[str, Any]:
    return _decode_token(token, settings.JWT_SECRET_KEY, ACCESS_TOKEN_TYPE)


def verify_refresh_token(token: str) -> dict[str, Any]:
    return _decode_token(token, settings.JWT_REFRESH_SECRET_KEY, REFRESH_TOKEN_TYPE)
