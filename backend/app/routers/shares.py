from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.models.shares import Share, Invitation
from app.utils.security import get_current_user
from app.utils.helpers import generate_share_token, generate_invite_code

router = APIRouter()


@router.post("/generate")
async def generate_share(
    target_type: str = Query(..., pattern="^(news|prediction|card)$"),
    target_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    target_id_str = str(target_id)
    existing_query = select(Share).where(
        Share.user_id == user.id,
        Share.target_type == target_type,
        Share.target_id == target_id_str,
    )
    existing_result = await db.execute(existing_query)
    existing = existing_result.scalar_one_or_none()

    if existing:
        return {
            "token": existing.token,
            "share_url": f"/share/{existing.token}",
            "click_count": existing.click_count,
        }

    token = generate_share_token(32)
    share = Share(
        user_id=user.id,
        token=token,
        target_type=target_type,
        target_id=target_id_str,
    )
    db.add(share)
    await db.commit()

    return {
        "token": token,
        "share_url": f"/share/{token}",
        "click_count": 0,
    }


@router.get("/stats")
async def get_share_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    shares_query = select(Share).where(Share.user_id == user.id)
    shares_result = await db.execute(shares_query)
    shares = shares_result.scalars().all()

    total_clicks = sum(s.click_count for s in shares)

    inv_query = select(Invitation).where(Invitation.user_id == user.id)
    inv_result = await db.execute(inv_query)
    invitations = inv_result.scalars().all()

    pending_invites = [i for i in invitations if i.status == "pending"]
    used_invites = [i for i in invitations if i.status == "used"]

    return {
        "total_shares": len(shares),
        "total_clicks": total_clicks,
        "pending_invitations": len(pending_invites),
        "used_invitations": len(used_invites),
        "shares": [
            {
                "token": s.token,
                "target_type": s.target_type,
                "target_id": str(s.target_id),
                "click_count": s.click_count,
                "created_at": s.created_at.isoformat(),
            }
            for s in shares
        ],
    }


@router.post("/invite")
async def create_invitation(
    reward_points: int = Query(50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    invite_code = generate_invite_code()
    invitation = Invitation(
        user_id=user.id,
        invite_code=invite_code,
        reward_points=reward_points,
    )
    db.add(invitation)
    await db.commit()

    return {
        "invite_code": invite_code,
        "share_url": f"/register?invite={invite_code}",
        "reward_points": reward_points,
    }


@router.post("/invite/{invite_code}/use")
async def use_invitation(
    invite_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    result = await db.execute(
        select(Invitation).where(Invitation.invite_code == invite_code)
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=404, detail="邀请码不存在")

    if invitation.status != "pending":
        raise HTTPException(status_code=400, detail="邀请码已被使用")

    if str(invitation.user_id) == str(user.id):
        raise HTTPException(status_code=400, detail="不能使用自己的邀请码")

    invitation.used_by = user.id
    invitation.used_at = datetime.utcnow()
    invitation.status = "used"

    inviter_query = await db.execute(
        select(User).where(User.id == invitation.user_id)
    )
    inviter = inviter_query.scalar_one_or_none()
    if inviter:
        inviter.points += invitation.reward_points

    user.points += invitation.reward_points

    from app.models.rewards import PointTransaction, TransactionType
    inviter_transaction = PointTransaction(
        user_id=invitation.user_id,
        transaction_type=TransactionType.INVITE.value,
        amount=invitation.reward_points,
        description=f"邀请好友奖励",
        related_id=invitation.id,
    )
    db.add(inviter_transaction)

    user_transaction = PointTransaction(
        user_id=user.id,
        transaction_type=TransactionType.INVITE.value,
        amount=invitation.reward_points,
        description=f"使用邀请码奖励",
        related_id=invitation.id,
    )
    db.add(user_transaction)

    await db.commit()

    return {
        "message": "邀请码使用成功",
        "reward_points": invitation.reward_points,
    }


# 这个路径参数路由必须放在所有固定路径路由的后面，否则会匹配到 stats 等路径
@router.get("/{token}")
async def track_share_click(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Share).where(Share.token == token))
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(status_code=404, detail="分享链接不存在")

    share.click_count += 1
    await db.commit()

    return {
        "target_type": share.target_type,
        "target_id": str(share.target_id),
        "click_count": share.click_count,
    }
