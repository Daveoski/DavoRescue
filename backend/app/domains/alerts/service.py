from __future__ import annotations

import asyncio
import json
import logging

import asyncpg
from pywebpush import WebPushException, webpush

from app.core.config import get_settings
from app.core.geo import bbox_around, haversine_m

log = logging.getLogger("davorescue.alerts")

MAX_PUSH_PER_INCIDENT = 500


async def users_to_alert(conn: asyncpg.Connection, lat: float, lng: float) -> list[dict]:
    """Subscribed users whose last known position is inside their own alert radius of the incident."""
    min_lat, max_lat, min_lng, max_lng = bbox_around(lat, lng, 200_000)
    rows = await conn.fetch(
        """
        select s.endpoint, s.p256dh, s.auth, u.id::text as user_id, u.last_lat, u.last_lng, u.alert_radius_km
        from push_subscriptions s join users u on u.id = s.user_id
        where u.last_lat between $1 and $2 and u.last_lng between $3 and $4
          and u.last_located_at > now() - interval '7 days'
        """,
        min_lat, max_lat, min_lng, max_lng,
    )
    return [
        dict(r) for r in rows
        if haversine_m(lat, lng, r["last_lat"], r["last_lng"]) <= r["alert_radius_km"] * 1000
    ][:MAX_PUSH_PER_INCIDENT]


def _send(sub: dict, payload: str) -> int | None:
    settings = get_settings()
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
            data=payload,
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            ttl=3600,
            headers={"Urgency": "high"},
        )
        return 201
    except WebPushException as exc:
        return exc.response.status_code if exc.response is not None else None
    except Exception:  # noqa: BLE001 — a bad subscription must not stop the fan-out
        log.exception("push failed")
        return None


async def push_incident(conn: asyncpg.Connection, incident: dict, exclude_user_id: str | None = None) -> int:
    if not get_settings().push_enabled:
        return 0
    targets = [t for t in await users_to_alert(conn, incident["lat"], incident["lng"]) if t["user_id"] != exclude_user_id]
    if not targets:
        return 0
    place = incident.get("road_name") or incident.get("lga") or "near you"
    payload = json.dumps({
        "title": f"{incident['subtype'].title()} · {place}",
        "body": incident.get("public_alert") or "Verified emergency reported near you.",
        "url": f"/incidents/{incident['ref']}",
        "tag": incident["ref"],
        "severity": incident["severity"],
    })
    statuses = await asyncio.gather(*(asyncio.to_thread(_send, t, payload) for t in targets))
    gone = [t["endpoint"] for t, s in zip(targets, statuses, strict=True) if s in (404, 410)]
    if gone:
        await conn.execute("delete from push_subscriptions where endpoint = any($1::text[])", gone)
    return sum(1 for s in statuses if s and 200 <= s < 300)
