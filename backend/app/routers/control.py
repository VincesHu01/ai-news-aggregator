from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.config import settings
from app.models.user import User
from app.services.control_service import (
    get_delivery_control,
    set_delivery_enabled,
    verify_control_signature,
)
from app.services.push_service import PushService
from app.utils.security import get_current_user

router = APIRouter()


class ControlUpdate(BaseModel):
    enabled: bool


def _response(row):
    return {
        "enabled": bool(row.enabled),
        "status": "running" if row.enabled else "paused",
        "updated_at": row.updated_at,
        "updated_by": row.updated_by,
        "message": "自动生成与飞书推送已开启" if row.enabled else "自动生成、NEXUS 导入与飞书推送均已暂停",
    }


@router.get("/status")
async def delivery_status():
    return _response(await get_delivery_control())


@router.put("/status")
async def update_delivery_status(
    payload: ControlUpdate,
    user: User = Depends(get_current_user),
):
    row = await set_delivery_enabled(payload.enabled, f"web:{user.id}")
    await PushService().send_feishu_control_card(payload.enabled)
    return _response(row)


@router.get("/action", response_class=HTMLResponse)
async def signed_delivery_action(
    action: Literal["pause", "resume"] = Query(...),
    expires: int = Query(...),
    signature: str = Query(...),
):
    if not verify_control_signature(action, expires, signature):
        raise HTTPException(status_code=403, detail="控制链接无效或已经过期")
    enabled = action == "resume"
    row = await set_delivery_enabled(enabled, f"feishu:{action}")
    state = "已恢复" if row.enabled else "已暂停"
    detail = "下次定时任务会正常生成并推送。" if row.enabled else "不会生成新简报，也不会写入 NEXUS 或发送飞书；历史记录不受影响。"
    return HTMLResponse(f"""<!doctype html><html lang='zh-CN'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>NEXUS 推送控制</title><body style='font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f6f3ec;color:#17211b;padding:48px 20px'><main style='max-width:560px;margin:auto;background:white;border:1px solid #ddd6c8;border-radius:20px;padding:36px'><p style='color:#55705e'>NEXUS KNOWLEDGE BRIEF</p><h1>新闻推送{state}</h1><p style='font-size:17px;line-height:1.8'>{detail}</p><a href='{settings.PUBLIC_APP_URL}/news' style='color:#246b45'>返回 NEXUS</a></main></body></html>""")
