from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.db import get_pool
from app.domains.agencies.router import router as agencies_router
from app.domains.alerts.router import router as alerts_router
from app.domains.auth.router import router as auth_router
from app.domains.incidents.router import responder_router
from app.domains.incidents.router import router as incidents_router
from app.domains.roads.router import router as roads_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="DavoRescue API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().cors_origins),
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Surface the first human-readable message; the UI shows it verbatim.
    first = exc.errors()[0] if exc.errors() else {}
    message = str(first.get("msg", "Invalid request")).removeprefix("Value error, ")
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    return JSONResponse(status_code=422, content={"detail": message, "field": field or None})


for router in (auth_router, incidents_router, responder_router, agencies_router, alerts_router, roads_router):
    app.include_router(router)


@app.get("/api/health", tags=["meta"])
async def health() -> dict:
    settings = get_settings()
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("select 1")
        database = "connected"
    except Exception as exc:  # noqa: BLE001 — health must report, not raise
        database = f"unavailable: {exc.__class__.__name__}"
    return {
        "status": "ok" if database == "connected" else "degraded",
        "database": database,
        "ai_verification": "claude" if settings.ai_enabled else "rules-only",
        "dispatch_mode": settings.dispatch_mode,
        "sms": bool(settings.termii_api_key),
        "email": bool(settings.resend_api_key),
        "push": settings.push_enabled,
    }
