from __future__ import annotations

import hmac

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import client_ip, fingerprint
from app.domains.auth.deps import current_user, optional_user, require_role
from app.domains.auth.schemas import UserOut
from app.domains.roadpulse import signals, trips
from app.domains.roadpulse.schemas import ExtendIn, PingIn, SignalIn, SignalReviewIn, TripIn

router = APIRouter(prefix="/api/pulse", tags=["road pulse"])
responder_router = APIRouter(prefix="/api/responder/signals", tags=["responder"])
trips_router = APIRouter(prefix="/api/trips", tags=["trip guardian"])

responder = require_role("responder", "admin")


@router.post("/signals", status_code=201)
async def report_signal(
    data: SignalIn,
    request: Request,
    user: UserOut | None = Depends(optional_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """A driver's check-in: all clear, vehicles turning back, or a warning sign. No account needed."""
    return await signals.record_signal(conn, data, user, fingerprint(client_ip(request)))


@router.get("")
async def warnings(response: Response, conn: asyncpg.Connection = Depends(get_db)) -> dict:
    """Public early warnings: only corroborated or confirmed ones."""
    response.headers["Cache-Control"] = "public, s-maxage=20"
    await trips.maybe_sweep(conn)
    return {"warnings": await signals.clusters(conn)}


@router.get("/sweep")
async def sweep(request: Request, conn: asyncpg.Connection = Depends(get_db)) -> dict:
    """For a minute-level scheduler: trip reminders and overdue alerts."""
    secret = get_settings().cron_secret
    if not secret or not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {secret}"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Scheduler only")
    return await trips.sweep(conn)


@responder_router.get("", dependencies=[Depends(responder)])
async def all_warnings(hours: int = Query(default=12, ge=1, le=72), conn: asyncpg.Connection = Depends(get_db)) -> list[dict]:
    return await signals.clusters(conn, include_private=True, hours=hours)


@responder_router.patch("/{cluster_id}")
async def review_warning(
    cluster_id: str,
    data: SignalReviewIn,
    user: UserOut = Depends(responder),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    return await signals.review(conn, cluster_id, data.action, data.note, user)


@trips_router.post("", status_code=201)
async def start_trip(data: TripIn, user: UserOut = Depends(current_user), conn: asyncpg.Connection = Depends(get_db)) -> dict:
    return await trips.start(conn, user, data)


@trips_router.get("/active")
async def active_trip(user: UserOut = Depends(current_user), conn: asyncpg.Connection = Depends(get_db)) -> dict:
    await trips.maybe_sweep(conn)
    return {"trip": await trips.active(conn, user)}


@trips_router.post("/{trip_id}/ping")
async def ping(trip_id: str, data: PingIn, user: UserOut = Depends(current_user), conn: asyncpg.Connection = Depends(get_db)) -> dict:
    # Live pings arrive every ~20 s from each active trip, which keeps overdue alerts on time.
    await trips.maybe_sweep(conn)
    return await trips.ping(conn, user, trip_id, data.lat, data.lng)


@trips_router.post("/{trip_id}/arrived")
async def arrived(trip_id: str, user: UserOut = Depends(current_user), conn: asyncpg.Connection = Depends(get_db)) -> dict:
    return await trips.finish(conn, user, trip_id, "arrived")


@trips_router.post("/{trip_id}/cancel")
async def cancel(trip_id: str, user: UserOut = Depends(current_user), conn: asyncpg.Connection = Depends(get_db)) -> dict:
    return await trips.finish(conn, user, trip_id, "cancelled")


@trips_router.post("/{trip_id}/extend")
async def extend(trip_id: str, data: ExtendIn, user: UserOut = Depends(current_user), conn: asyncpg.Connection = Depends(get_db)) -> dict:
    return await trips.extend(conn, user, trip_id, data.minutes)


@trips_router.get("/shared/{token}")
async def shared(token: str, conn: asyncpg.Connection = Depends(get_db)) -> dict:
    """The tracking page contacts open from the traveller's link. No account needed."""
    await trips.maybe_sweep(conn)
    return await trips.shared(conn, token)
