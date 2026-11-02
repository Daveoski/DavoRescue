from __future__ import annotations

import hmac

import asyncpg
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.domains.auth.deps import fetch_user
from app.domains.auth.schemas import AuthOut, LoginIn, ProfileUpdateIn, RegisterIn, UserOut, normalise_ng_phone


async def register(conn: asyncpg.Connection, data: RegisterIn) -> AuthOut:
    role = "citizen"
    agency_slug = None
    if data.invite_code:
        expected = get_settings().responder_invite_code
        if not expected or not hmac.compare_digest(data.invite_code, expected):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That responder invite code is not valid")
        if data.agency_slug:
            exists = await conn.fetchval("select 1 from agencies where slug = $1", data.agency_slug)
            if not exists:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown agency")
        role, agency_slug = "responder", data.agency_slug

    try:
        user_id = await conn.fetchval(
            """
            insert into users (full_name, phone, email, password_hash, role, agency_slug)
            values ($1, $2, $3, $4, $5, $6) returning id::text
            """,
            data.full_name, data.phone, data.email.lower() if data.email else None,
            hash_password(data.password), role, agency_slug,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with that phone number or email already exists")

    user = await fetch_user(conn, user_id)
    assert user is not None
    return AuthOut(token=create_access_token(user.id, user.role), user=user)


async def login(conn: asyncpg.Connection, data: LoginIn) -> AuthOut:
    identifier = data.identifier.strip()
    if "@" in identifier:
        row = await conn.fetchrow("select id::text, password_hash from users where email = $1", identifier.lower())
    else:
        try:
            phone = normalise_ng_phone(identifier)
        except ValueError:
            phone = identifier
        row = await conn.fetchrow("select id::text, password_hash from users where phone = $1", phone)

    if not row or not verify_password(data.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Phone/email or password is incorrect")

    user = await fetch_user(conn, row["id"])
    assert user is not None
    return AuthOut(token=create_access_token(user.id, user.role), user=user)


async def update_profile(conn: asyncpg.Connection, user: UserOut, data: ProfileUpdateIn) -> UserOut:
    if data.alert_radius_km is not None:
        await conn.execute("update users set alert_radius_km = $2 where id = $1::uuid", user.id, data.alert_radius_km)
    if data.lat is not None and data.lng is not None:
        await conn.execute(
            "update users set last_lat = $2, last_lng = $3, last_located_at = now() where id = $1::uuid",
            user.id, data.lat, data.lng,
        )
    updated = await fetch_user(conn, user.id)
    assert updated is not None
    return updated
