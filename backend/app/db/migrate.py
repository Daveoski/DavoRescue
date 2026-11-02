"""Apply the schema and upsert the agency directory.

    python -m app.db.migrate
"""

from __future__ import annotations

import asyncio
import json
from datetime import date
from pathlib import Path

import asyncpg

from app.core.config import get_settings
from app.core.db import normalise_dsn

SCHEMA = Path(__file__).with_name("schema.sql")
DIRECTORY = Path(__file__).parents[1] / "domains" / "agencies" / "directory.json"


async def migrate() -> None:
    conn = await asyncpg.connect(normalise_dsn(get_settings().database_url), statement_cache_size=0)
    try:
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
        print(f"schema applied; {len(directory['agencies'])} agencies upserted")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate())
