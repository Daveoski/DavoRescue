from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.db import get_db
from app.core.geo import SOUTH_EAST
from app.domains.agencies.repository import list_agencies
from app.domains.auth.deps import require_role

router = APIRouter(prefix="/api/agencies", tags=["agencies"])


@router.get("")
async def agencies(
    state: str | None = Query(default=None, description="enugu, anambra, abia, ebonyi or imo"),
    conn: asyncpg.Connection = Depends(get_db),
) -> list[dict]:
    if state and state not in SOUTH_EAST:
        raise HTTPException(404, "We only cover the South-East states")
    return await list_agencies(conn, state)


class AgencyContactsIn(BaseModel):
    phones: list[str] | None = Field(default=None, max_length=10)
    sms_phones: list[str] | None = Field(default=None, max_length=10)
    emails: list[str] | None = Field(default=None, max_length=10)
    active: bool | None = None
    source_note: str | None = Field(default=None, max_length=400)


@router.patch("/{slug}", dependencies=[Depends(require_role("admin"))])
async def update_contacts(slug: str, data: AgencyContactsIn, conn: asyncpg.Connection = Depends(get_db)) -> dict:
    """Admins keep the directory current as agencies change numbers."""
    fields = data.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(400, "Nothing to update")
    assignments = ", ".join(f"{name} = ${i}" for i, name in enumerate(fields, start=2))
    row = await conn.fetchrow(
        f"update agencies set {assignments}, verified_on = current_date, updated_at = now() where slug = $1 returning slug",
        slug, *fields.values(),
    )
    if not row:
        raise HTTPException(404, "Agency not found")
    return {"slug": slug, "updated": list(fields)}
