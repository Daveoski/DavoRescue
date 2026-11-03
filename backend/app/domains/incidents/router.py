from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from app.core.db import get_db
from app.core.geo import SOUTH_EAST
from app.core.security import client_ip, fingerprint
from app.domains.auth.deps import optional_user, require_role
from app.domains.auth.schemas import UserOut
from app.domains.incidents import repository as repo
from app.domains.incidents import service
from app.domains.incidents.schemas import IncidentIn, StatusUpdateIn

router = APIRouter(prefix="/api/incidents", tags=["incidents"])
responder_router = APIRouter(prefix="/api/responder", tags=["responder"])

responder = require_role("responder", "admin")


@router.post("", status_code=201)
async def report(
    data: IncidentIn,
    request: Request,
    user: UserOut | None = Depends(optional_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Report an emergency. No account needed."""
    return await service.create_report(conn, data, user, fingerprint(client_ip(request)))


@router.get("")
async def live(
    hours: int = Query(default=24, ge=1, le=168),
    state: str | None = Query(default=None),
    conn: asyncpg.Connection = Depends(get_db),
) -> list[dict]:
    if state and state not in SOUTH_EAST:
        raise HTTPException(404, "We only cover the South-East states")
    return await repo.list_public(conn, hours=hours, state=state)


@router.get("/stats")
async def stats(conn: asyncpg.Connection = Depends(get_db)) -> dict:
    return await repo.stats(conn)


@router.get("/{ref}")
async def public_incident(ref: str, conn: asyncpg.Connection = Depends(get_db)) -> dict:
    incident = await repo.get_public(conn, ref)
    if not incident:
        raise HTTPException(404, "No public incident with that reference")
    return incident


@responder_router.get("/incidents", dependencies=[Depends(responder)])
async def queue(
    status: list[str] | None = Query(default=None),
    hours: int = Query(default=48, ge=1, le=720),
    state: str | None = Query(default=None),
    conn: asyncpg.Connection = Depends(get_db),
) -> list[dict]:
    return await repo.responder_list(conn, statuses=status, hours=hours, state=state)


@responder_router.get("/incidents/{ref}", dependencies=[Depends(responder)])
async def detail(ref: str, conn: asyncpg.Connection = Depends(get_db)) -> dict:
    incident = await repo.responder_detail(conn, ref)
    if not incident:
        raise HTTPException(404, "Incident not found")
    return incident


@responder_router.patch("/incidents/{ref}")
async def set_status(
    ref: str,
    data: StatusUpdateIn,
    user: UserOut = Depends(responder),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    return await service.update_status(conn, ref, data.status, data.note, user)


@responder_router.get("/incidents/{ref}/media/{media_id}", dependencies=[Depends(responder)])
async def media(ref: str, media_id: str, conn: asyncpg.Connection = Depends(get_db)) -> Response:
    row = await repo.get_media(conn, ref, media_id)
    if not row:
        raise HTTPException(404, "Photo not found")
    return Response(content=row["bytes"], media_type=row["mime"], headers={"Cache-Control": "private, max-age=3600"})
