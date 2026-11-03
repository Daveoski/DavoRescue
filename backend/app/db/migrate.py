"""Apply the schema and upsert the agency directory and Road Watch stretches.

    python -m app.db.migrate
"""

from __future__ import annotations

import asyncio
import json
from datetime import date
from pathlib import Path

import asyncpg

from app.core.config import get_settings
from app.core.db import init_connection, normalise_dsn

SCHEMA = Path(__file__).with_name("schema.sql")
DIRECTORY = Path(__file__).parents[1] / "domains" / "agencies" / "directory.json"
CORRIDORS = Path(__file__).parents[1] / "domains" / "roadwatch" / "corridors.json"


async def seed_road_segments(conn: asyncpg.Connection) -> int:
    corridors = json.loads(CORRIDORS.read_text(encoding="utf-8"))["corridors"]
    rows = []
    for c in corridors:
        for s in c["segments"]:
            lats = [p[0] for p in s["path"]]
            lngs = [p[1] for p in s["path"]]
            rows.append((
                f"{c['id']}-{s['seq']}", c["id"], c["name"], c.get("ref"), s["seq"], s["label"], s.get("lga"),
                s["length_m"], s["path"], min(lats), max(lats), min(lngs), max(lngs),
            ))
    async with conn.transaction():
        await conn.executemany(
            """
            insert into road_segments (id, corridor_id, corridor_name, ref, seq, label, lga, length_m, path,
                                       min_lat, max_lat, min_lng, max_lng)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            on conflict (id) do update set
              corridor_id = excluded.corridor_id, corridor_name = excluded.corridor_name, ref = excluded.ref,
              seq = excluded.seq, label = excluded.label, lga = excluded.lga, length_m = excluded.length_m,
              path = excluded.path, min_lat = excluded.min_lat, max_lat = excluded.max_lat,
              min_lng = excluded.min_lng, max_lng = excluded.max_lng
            """,
            rows,
        )
        # Stretches removed from the file disappear (with their assessments).
        await conn.execute("delete from road_segments where id <> all($1::text[])", [r[0] for r in rows])
    return len(rows)


async def migrate() -> None:
    conn = await asyncpg.connect(normalise_dsn(get_settings().database_url), statement_cache_size=0)
    try:
        await init_connection(conn)  # JSON codecs for the jsonb columns
        await conn.execute(SCHEMA.read_text(encoding="utf-8"))
        directory = json.loads(DIRECTORY.read_text(encoding="utf-8"))
        checked_on = date.fromisoformat(directory["checked_on"])
        async with conn.transaction():
            for a in directory["agencies"]:
                await conn.execute(
                    """
                    insert into agencies (slug, name, short_name, kind, categories, state, phones, sms_phones,
                                          emails, address, source_url, source_note, verified_on, priority, updated_at)
                    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
                    on conflict (slug) do update set
                      name = excluded.name, short_name = excluded.short_name, kind = excluded.kind,
                      categories = excluded.categories, state = excluded.state, phones = excluded.phones,
                      sms_phones = excluded.sms_phones, emails = excluded.emails, address = excluded.address,
                      source_url = excluded.source_url, source_note = excluded.source_note,
                      verified_on = excluded.verified_on, priority = excluded.priority, updated_at = now()
                    """,
                    a["slug"], a["name"], a["short_name"], a["kind"], a["categories"], a["state"],
                    a["phones"], a["sms_phones"], a["emails"], a.get("address"), a.get("source_url"),
                    a.get("source_note"), checked_on, a.get("priority", 50),
                )
        stretches = await seed_road_segments(conn)
        print(f"schema applied; {len(directory['agencies'])} agencies and {stretches} road stretches upserted")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate())
