from __future__ import annotations

import hmac

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.core.config import get_settings
from app.core.db import get_db
from app.domains.auth.deps import optional_user
from app.domains.auth.schemas import UserOut
from app.domains.roadwatch import service

router = APIRouter(prefix="/api/roadwatch", tags=["road watch"])


@router.get("")
async def road_watch(response: Response, conn: asyncpg.Connection = Depends(get_db)) -> dict:
    """Major Enugu roads, stretch by stretch: satellite review plus live incident risk."""
    # Short: live early warnings change this response.
    response.headers["Cache-Control"] = "public, s-maxage=30, stale-while-revalidate=120"
    return await service.road_watch(conn)


def _authorised(request: Request, user: UserOut | None) -> bool:
    if user is not None and user.role == "admin":
        return True
    secret = get_settings().cron_secret
    header = request.headers.get("authorization", "")
    return bool(secret) and hmac.compare_digest(header, f"Bearer {secret}")


# Vercel Cron calls with GET; admins trigger the same scan with POST from the Road Watch page.
@router.api_route("/scan", methods=["GET", "POST"])
async def scan(
    request: Request,
    limit: int = Query(default=service.DEFAULT_BATCH, ge=1, le=20),
    user: UserOut | None = Depends(optional_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    if not _authorised(request, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins and the scheduler can start a road scan")
    return await service.scan(conn, limit)
