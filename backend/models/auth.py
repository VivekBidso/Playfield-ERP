"""Authentication and User models"""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List
from datetime import datetime, timezone
import uuid


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    name: str
    role: str  # "master_admin" or "branch_user"
    assigned_branches: List[str] = []  # Empty for master_admin, specific branches for branch_user
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    assigned_branches: List[str] = []


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    assigned_branches: List[str]
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
