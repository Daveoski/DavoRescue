from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

from app.core.config import get_settings

# asyncpg forwards unknown query params as server settings; Neon URLs carry
# libpq-only options (channel_binding) that Postgres would reject.
_LIBPQ_ONLY_PARAMS = {"channel_binding", "options", "pgbouncer"}

_pools: dict[int, asyncpg.Pool] = {}


def normalise_dsn(url: str) -> str:
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k not in _LIBPQ_ONLY_PARAMS]
    return urlunsplit(parts._replace(query=urlencode(query)))


async def _init_connection(conn: asyncpg.Connection) -> None:
    for kind in ("json", "jsonb"):
        await conn.set_type_codec(kind, encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def get_pool() -> asyncpg.Pool:
    # Pools are bound to the event loop that created them; serverless
    # instances can be reused across loops, so key the pool by loop.
    loop_id = id(asyncio.get_running_loop())
    pool = _pools.get(loop_id)
    if pool is None:
        dsn = get_settings().database_url
        if not dsn:
            raise RuntimeError("DATABASE_URL is not configured")
        pool = await asyncpg.create_pool(
            normalise_dsn(dsn),
            min_size=0,
            max_size=5,
            statement_cache_size=0,  # required behind Neon's PgBouncer pooler
            max_inactive_connection_lifetime=45,
            command_timeout=20,
            init=_init_connection,
        )
        _pools[loop_id] = pool
    return pool


async def get_db() -> AsyncIterator[asyncpg.Connection]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn
