import hashlib
import hmac
import time
from datetime import datetime
from urllib.parse import urlencode

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.control import DeliveryControl


async def get_delivery_control() -> DeliveryControl:
    async with async_session() as db:
        row = (await db.execute(
            select(DeliveryControl).where(DeliveryControl.id == "global")
        )).scalar_one_or_none()
        if row:
            return row
        row = DeliveryControl(id="global", enabled=True, updated_by="system-default")
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row


async def set_delivery_enabled(enabled: bool, updated_by: str) -> DeliveryControl:
    async with async_session() as db:
        row = (await db.execute(
            select(DeliveryControl).where(DeliveryControl.id == "global")
        )).scalar_one_or_none()
        if not row:
            row = DeliveryControl(id="global")
            db.add(row)
        row.enabled = enabled
        row.updated_by = updated_by[:100]
        row.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(row)
        return row


def _signature(action: str, expires: int) -> str:
    message = f"{action}:{expires}".encode()
    return hmac.new(settings.NEXUS_INGEST_TOKEN.encode(), message, hashlib.sha256).hexdigest()


def make_control_url(action: str, lifetime_seconds: int = 60 * 60 * 24 * 90) -> str:
    expires = int(time.time()) + lifetime_seconds
    query = urlencode({"action": action, "expires": expires, "signature": _signature(action, expires)})
    return f"{settings.PUBLIC_API_URL.rstrip('/')}/api/control/action?{query}"


def verify_control_signature(action: str, expires: int, signature: str) -> bool:
    if action not in {"pause", "resume"} or expires < int(time.time()):
        return False
    return hmac.compare_digest(signature, _signature(action, expires))
