from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.db import get_db
from app.domains.auth.deps import current_user
from app.domains.auth.schemas import UserOut
from app.domains.incidents.repository import incidents_near

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class PushKeys(BaseModel):
    p256dh: str = Field(max_length=200)
    auth: str = Field(max_length=100)


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(max_length=1000)
    keys: PushKeys


@router.get("/push-key")
async def push_key() -> dict:
    settings = get_settings()
    return {"enabled": settings.push_enabled, "public_key": settings.vapid_public_key or None}


@router.post("/subscriptions", status_code=201)
async def subscribe(
    sub: PushSubscriptionIn,
    user: UserOut = Depends(current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    await conn.execute(
        """
        insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ($1, $2::uuid, $3, $4)
        on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
        """,
        sub.endpoint, user.id, sub.keys.p256dh, sub.keys.auth,
    )
    return {"subscribed": True}


@router.delete("/subscriptions")
async def unsubscribe(
    endpoint: str = Query(max_length=1000),
    user: UserOut = Depends(current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    await conn.execute("delete from push_subscriptions where endpoint = $1 and user_id = $2::uuid", endpoint, user.id)
    return {"subscribed": False}


@router.get("/feed")
async def feed(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    hours: int = Query(default=24, ge=1, le=168),
    user: UserOut = Depends(current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Verified incidents inside the signed-in user's alert radius."""
    lat = lat if lat is not None else user.last_lat
    lng = lng if lng is not None else user.last_lng
    if lat is None or lng is None:
        return {"located": False, "radius_km": user.alert_radius_km, "items": []}
    items = await incidents_near(conn, lat, lng, user.alert_radius_km * 1000, hours)
    return {"located": True, "radius_km": user.alert_radius_km, "items": items}
