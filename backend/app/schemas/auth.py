from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email_or_username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="crew", pattern="^(admin|crew)$")
    ship_id: Optional[int] = None


class UserSummary(BaseModel):
    id: int
    email: EmailStr
    username: str
    role: str
    ship_id: Optional[int] = None

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    message: str
    user: Optional[UserSummary] = None


class MessageResponse(BaseModel):
    message: str
