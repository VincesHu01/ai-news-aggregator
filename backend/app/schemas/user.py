from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    nickname: Optional[str] = Field(None, min_length=2, max_length=50)
    invite_code: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    level: int
    experience: int
    points: int
    intelligence: int
    invite_code: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserProfile(BaseModel):
    nickname: Optional[str] = Field(None, min_length=2, max_length=50)
    avatar_url: Optional[str] = None


TokenResponse.model_rebuild()
