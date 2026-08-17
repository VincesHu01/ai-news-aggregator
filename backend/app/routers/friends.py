from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.friendship import Friendship
from app.utils.security import get_current_user

router = APIRouter()


@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """搜索用户（按邮箱或昵称），排除自己和已有好友"""
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    query = select(User).where(
        or_(
            User.email.ilike(f"%{q}%"),
            User.nickname.ilike(f"%{q}%"),
        ),
        User.id != user.id,
    ).limit(20)

    result = await db.execute(query)
    users = result.scalars().all()

    # 获取已有好友关系
    friend_q = select(Friendship).where(
        or_(
            Friendship.user_id == user.id,
            Friendship.friend_id == user.id,
        )
    )
    friend_result = await db.execute(friend_q)
    friendships = friend_result.scalars().all()
    friend_ids = set()
    for f in friendships:
        if f.user_id == user.id:
            friend_ids.add(f.friend_id)
        else:
            friend_ids.add(f.user_id)

    return [
        {
            "id": u.id,
            "nickname": u.nickname or u.email.split("@")[0],
            "email": u.email,
            "avatar_url": u.avatar_url,
            "level": u.level,
            "is_friend": u.id in friend_ids,
        }
        for u in users
    ]


@router.post("/request")
async def send_friend_request(
    to_user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发送好友请求"""
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    if to_user_id == user.id:
        raise HTTPException(status_code=400, detail="不能添加自己为好友")

    recipient = await db.get(User, to_user_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 检查是否已有关系
    existing_q = select(Friendship).where(
        or_(
            and_(Friendship.user_id == user.id, Friendship.friend_id == to_user_id),
            and_(Friendship.user_id == to_user_id, Friendship.friend_id == user.id),
        )
    )
    existing = (await db.execute(existing_q)).scalar_one_or_none()
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="你们已经是好友了")
        if existing.status == "pending":
            # 如果对方先向我发了请求，直接接受
            if existing.user_id == to_user_id:
                existing.status = "accepted"
                existing.accepted_at = datetime.utcnow()
                await db.commit()
                return {"status": "ok", "message": f"已自动接受 {recipient.nickname} 的好友请求"}
            raise HTTPException(status_code=400, detail="好友请求已发送，等待对方确认")
        if existing.status == "blocked":
            raise HTTPException(status_code=400, detail="无法添加该用户为好友")

    friendship = Friendship(
        user_id=user.id,
        friend_id=to_user_id,
        status="pending",
    )
    db.add(friendship)
    await db.commit()

    return {"status": "ok", "message": f"好友请求已发送给 {recipient.nickname or recipient.email}"}


@router.post("/{friendship_id}/accept")
async def accept_friend_request(
    friendship_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """接受好友请求"""
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    friendship = await db.get(Friendship, friendship_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="好友请求不存在")

    if friendship.friend_id != user.id:
        raise HTTPException(status_code=403, detail="这不是发给你的好友请求")

    if friendship.status != "pending":
        raise HTTPException(status_code=400, detail="该请求已处理")

    friendship.status = "accepted"
    friendship.accepted_at = datetime.utcnow()

    # 创建反向关系
    reverse = Friendship(
        user_id=user.id,
        friend_id=friendship.user_id,
        status="accepted",
        accepted_at=datetime.utcnow(),
    )
    db.add(reverse)
    await db.commit()

    return {"status": "ok", "message": "好友请求已接受"}


@router.post("/{friendship_id}/reject")
async def reject_friend_request(
    friendship_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """拒绝好友请求"""
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    friendship = await db.get(Friendship, friendship_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="好友请求不存在")

    if friendship.friend_id != user.id:
        raise HTTPException(status_code=403, detail="这不是发给你的好友请求")

    await db.delete(friendship)
    await db.commit()

    return {"status": "ok", "message": "已拒绝好友请求"}


@router.get("/requests")
async def list_friend_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """收到的待处理好友请求"""
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    q = (
        select(Friendship, User)
        .join(User, Friendship.user_id == User.id)
        .where(
            Friendship.friend_id == user.id,
            Friendship.status == "pending",
        )
    )
    result = await db.execute(q)
    rows = result.all()

    return [
        {
            "friendship_id": f.id,
            "from_user": {
                "id": u.id,
                "nickname": u.nickname or u.email.split("@")[0],
                "email": u.email,
                "avatar_url": u.avatar_url,
                "level": u.level,
            },
            "created_at": f.created_at.isoformat(),
        }
        for f, u in rows
    ]


@router.get("/")
async def list_friends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """好友列表"""
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    q = (
        select(Friendship, User)
        .join(User, Friendship.friend_id == User.id)
        .where(
            Friendship.user_id == user.id,
            Friendship.status == "accepted",
        )
    )
    result = await db.execute(q)
    rows = result.all()

    return [
        {
            "friendship_id": f.id,
            "id": u.id,
            "nickname": u.nickname or u.email.split("@")[0],
            "email": u.email,
            "avatar_url": u.avatar_url,
            "level": u.level,
            "accepted_at": f.accepted_at.isoformat() if f.accepted_at else None,
        }
        for f, u in rows
    ]


@router.delete("/{friend_id}")
async def remove_friend(
    friend_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除好友（双向删除）"""
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    # 删除双向关系
    q = select(Friendship).where(
        or_(
            and_(Friendship.user_id == user.id, Friendship.friend_id == friend_id),
            and_(Friendship.user_id == friend_id, Friendship.friend_id == user.id),
        )
    )
    result = await db.execute(q)
    friendships = result.scalars().all()

    for f in friendships:
        await db.delete(f)

    await db.commit()

    return {"status": "ok", "message": "已删除好友"}
