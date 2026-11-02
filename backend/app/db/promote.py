"""Change a user's role, e.g. to make the first admin.

    python -m app.db.promote 08031234567 admin
    python -m app.db.promote 08031234567 responder --agency enugu-police-control-room
"""

from __future__ import annotations

import argparse
import asyncio

import asyncpg

from app.core.config import get_settings
from app.core.db import normalise_dsn
from app.domains.auth.schemas import normalise_ng_phone


async def promote(phone: str, role: str, agency: str | None) -> None:
    conn = await asyncpg.connect(normalise_dsn(get_settings().database_url), statement_cache_size=0)
    try:
        row = await conn.fetchrow(
            "update users set role = $2, agency_slug = coalesce($3, agency_slug) where phone = $1 returning full_name",
            normalise_ng_phone(phone), role, agency,
        )
        print(f"{row['full_name']} is now {role}" if row else "No user with that phone number")
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("phone")
    parser.add_argument("role", choices=["citizen", "responder", "admin"])
    parser.add_argument("--agency", default=None)
    args = parser.parse_args()
    asyncio.run(promote(args.phone, args.role, args.agency))
