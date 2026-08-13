from datetime import datetime, timedelta
from typing import Optional
import hashlib
import secrets

from fastapi import Depends, HTTPException, status, Request
from jose import JWTError, jwt

from app.config import settings
from app.database import async_session
from app.models.user import User


def get_password_hash(password: str) -> str:
    salt = secrets_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hashed}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt, _ = hashed_password.split("$", 1)
        check = hashlib.sha256((salt + plain_password).encode()).hexdigest()
        return f"{salt}${check}" == hashed_password
    except (ValueError, IndexError):
        return False


def secrets_hex(nbytes: int) -> str:
    return secrets.token_hex(nbytes)


def create_access_token(
    user_id: str, expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = {"sub": str(user_id), "type": "access"}
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return str(user_id)
    except JWTError:
        return None


def generate_verification_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


async def get_current_user(
    request: Request,
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise credentials_exception

    token = auth_header.split(" ")[1]
    user_id = verify_access_token(token)
    if user_id is None:
        raise credentials_exception

    from sqlalchemy import select

    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    return user


async def get_optional_current_user(
    request: Request,
) -> Optional[User]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    user_id = verify_access_token(token)
    if user_id is None:
        return None

    from sqlalchemy import select

    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

    return user
