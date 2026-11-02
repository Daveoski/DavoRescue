from __future__ import annotations

import asyncpg
from fastapi import APIRouter, Depends

from app.core.db import get_db
from app.domains.auth import service
from app.domains.auth.deps import current_user
from app.domains.auth.schemas import AuthOut, LoginIn, ProfileUpdateIn, RegisterIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthOut, status_code=201)
async def register(data: RegisterIn, conn: asyncpg.Connection = Depends(get_db)) -> AuthOut:
    return await service.register(conn, data)


@router.post("/login", response_model=AuthOut)
async def login(data: LoginIn, conn: asyncpg.Connection = Depends(get_db)) -> AuthOut:
    return await service.login(conn, data)


@router.get("/me", response_model=UserOut)
async def me(user: UserOut = Depends(current_user)) -> UserOut:
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: ProfileUpdateIn,
    user: UserOut = Depends(current_user),
    conn: asyncpg.Connection = Depends(get_db),
) -> UserOut:
    return await service.update_profile(conn, user, data)
