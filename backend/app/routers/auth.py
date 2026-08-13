from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse, UserProfile
from app.utils.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    generate_verification_code,
)
from app.utils.helpers import generate_invite_code

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册",
        )

    if user_data.invite_code:
        inviter_result = await db.execute(
            select(User).where(User.invite_code == user_data.invite_code)
        )
        inviter = inviter_result.scalar_one_or_none()
        if not inviter:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的邀请码",
            )
        else:
            invited_by = inviter.id
    else:
        invited_by = None

    new_user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        nickname=user_data.nickname or user_data.email.split("@")[0],
        invite_code=generate_invite_code(),
        invited_by=invited_by,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(user_id=new_user.id)
    user_response = UserResponse.model_validate(new_user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
    )


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
        )

    access_token = create_access_token(user_id=user.id)
    user_response = UserResponse.model_validate(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
    )


@router.post("/send-verification-code")
async def send_verification_code(email: str, request: Request):
    code = generate_verification_code()
    try:
        from app.config import settings
        import smtplib
        from email.mime.text import MIMEText

        if settings.MAIL_SERVER and settings.MAIL_USERNAME:
            msg = MIMEText(f"您的验证码是: {code}，5分钟内有效。")
            msg["Subject"] = "AI News - 邮箱验证"
            msg["From"] = settings.MAIL_FROM or settings.MAIL_USERNAME
            msg["To"] = email

            with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
                if settings.MAIL_USE_TLS:
                    server.starttls()
                server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                server.sendmail(
                    settings.MAIL_FROM or settings.MAIL_USERNAME,
                    email,
                    msg.as_string(),
                )
    except Exception:
        pass

    return {"message": "验证码已发送", "code": code}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    profile_data: UserProfile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if profile_data.nickname is not None:
        current_user.nickname = profile_data.nickname
    if profile_data.avatar_url is not None:
        current_user.avatar_url = profile_data.avatar_url

    await db.commit()
    await db.refresh(current_user)
    return current_user