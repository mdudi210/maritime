from __future__ import annotations

from datetime import datetime
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
    all_ships: bool = False


class UserUpdateRequest(BaseModel):
    role: Optional[str] = Field(default=None, pattern="^(admin|crew)$")
    ship_id: Optional[int] = None
    all_ships: Optional[bool] = None
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(default=None, min_length=2, max_length=120)
    is_active: Optional[bool] = None


class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = Field(default=None, min_length=2, max_length=120)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AdminPasswordResetRequest(BaseModel):
    temporary_password: str = Field(min_length=8, max_length=128)


class UserSummary(BaseModel):
    id: int
    email: EmailStr
    username: str
    role: str
    ship_id: Optional[int] = None
    all_ships: bool = False
    is_active: bool
    password_reset_required: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None
    total_drills_assigned: int = 0
    total_drills_completed: int = 0

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    message: str
    user: Optional[UserSummary] = None


class MessageResponse(BaseModel):
    message: str
