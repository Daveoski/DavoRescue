from __future__ import annotations

from collections.abc import Callable

import asyncpg
from fastapi import Depends, HTTPException, Request, status

from app.core.db import get_db
from app.core.security import decode_access_token
from app.domains.auth.schemas import UserOut

_USER_COLUMNS = "id::text, full_name, phone, email, role, agency_slug, alert_radius_km, last_lat, last_lng"


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    return token if scheme.lower() == "bearer" and token else None


async def fetch_user(conn: asyncpg.Connection, user_id: str) -> UserOut | None:
    row = await conn.fetchrow(f"select {_USER_COLUMNS} from users where id = $1::uuid", user_id)
    return UserOut(**dict(row)) if row else None


async def optional_user(request: Request, conn: asyncpg.Connection = Depends(get_db)) -> UserOut | None:
    token = _bearer(request)
    if not token:
        return None
    claims = decode_access_token(token)
    if not claims:
        return None
    return await fetch_user(conn, claims["sub"])


async def current_user(user: UserOut | None = Depends(optional_user)) -> UserOut:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue")
    return user


def require_role(*roles: str) -> Callable:
    async def checker(user: UserOut = Depends(current_user)) -> UserOut:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This area is for verified responders")
        return user

    return checker
