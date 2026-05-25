"""Authentication API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import timedelta

from app.core.limiter import limiter
from app.db.session import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_active_user,
)
from app.models import User
from app.config import get_settings

settings = get_settings()
router = APIRouter()


class UserCreate(BaseModel):
    """Schema for user registration."""

    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    # bcrypt truncates beyond 72 bytes; reject early instead of silently truncating
    password: str = Field(min_length=8, max_length=72)
    full_name: str


class UserResponse(BaseModel):
    """User response schema."""

    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    is_active: bool


class Token(BaseModel):
    """Token response schema."""

    access_token: str
    token_type: str


@router.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")
async def register(
    request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)
):
    """Register a new user."""
    # Check if username exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        is_active=True,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
    )


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login and get access token."""
    # Get user by username
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Reject deactivated accounts after we've verified credentials so we don't
    # leak which usernames exist via differing status codes.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user"
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information."""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
    )
