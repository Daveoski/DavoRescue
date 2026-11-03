"""Run Road Watch scans from a terminal, e.g. to review every stretch at once.

    python -m app.db.scan_roads            # one batch
    python -m app.db.scan_roads --all      # keep going until every stretch has a fresh review
"""

from __future__ import annotations

import argparse
import asyncio

import asyncpg

from app.core.config import get_settings
from app.core.db import init_connection, normalise_dsn
from app.domains.roadwatch import service


async def main(scan_all: bool, batch: int) -> None:
    conn = await asyncpg.connect(normalise_dsn(get_settings().database_url), statement_cache_size=0)
    await init_connection(conn)
    try:
        total = await conn.fetchval("select count(*) from road_segments")
        rounds = -(-total // batch) if scan_all else 1
        for i in range(rounds):
            result = await service.scan(conn, batch)
            methods = {r["method"] for r in result["reviewed"]}
            print(f"batch {i + 1}/{rounds}: {len(result['reviewed'])} reviewed ({', '.join(sorted(methods)) or '-'}), "
                  f"{len(result['failed'])} failed {[f['segment'] for f in result['failed']] or ''}")
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--batch", type=int, default=service.DEFAULT_BATCH)
    args = parser.parse_args()
    asyncio.run(main(args.all, args.batch))
