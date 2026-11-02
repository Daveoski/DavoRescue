from __future__ import annotations

import httpx

from app.core.config import get_settings


def user_agent() -> str:
    # OSM services require an identifying User-Agent.
    return f"DavoRescue/1.0 (+{get_settings().site_url})"


def client(timeout: float = 6.0) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout, headers={"User-Agent": user_agent()})
