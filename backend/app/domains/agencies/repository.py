from __future__ import annotations

import asyncpg

# Which agency kinds answer which verification "needs".
NEED_TO_KINDS: dict[str, tuple[str, ...]] = {
    "police": ("police", "security"),
    "fire": ("fire", "security"),
    "ambulance": ("ambulance", "security"),
    "road_safety": ("frsc",),
    "disaster": ("nema",),
}

_COLUMNS = """slug, name, short_name, kind, categories, state, phones, sms_phones, emails, address,
              source_url, source_note, verified_on, priority"""


async def list_agencies(conn: asyncpg.Connection, state: str | None = None) -> list[dict]:
    if state:
        rows = await conn.fetch(
            f"select {_COLUMNS} from agencies where active and state in ($1, 'national') order by priority desc, name",
            state,
        )
    else:
        rows = await conn.fetch(f"select {_COLUMNS} from agencies where active order by state, priority desc, name")
    return [dict(r) for r in rows]


async def agencies_for(conn: asyncpg.Connection, state: str, needs: list[str]) -> list[dict]:
    """Agencies that should receive a dispatch: state-level responders for each need.

    National lines (112, FRSC 122, NEMA) are listed to the public for calling,
    but only receive automated dispatch where they have an SMS/email channel.
    """
    kinds = sorted({k for need in needs for k in NEED_TO_KINDS.get(need, ())})
    if not kinds:
        return []
    rows = await conn.fetch(
        f"""
        select {_COLUMNS} from agencies
        where active and kind = any($2::text[]) and (state = $1 or state = 'national')
        order by (state = $1) desc, priority desc
        """,
        state, kinds,
    )
    return [dict(r) for r in rows]
