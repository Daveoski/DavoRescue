from __future__ import annotations

import asyncio

import anthropic

from app.core.config import get_settings

_clients: dict[int, anthropic.AsyncAnthropic] = {}

# Refusal fallback: if the model declines, the API retries on a fallback model in the same call.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


def get_client(timeout: float = 25.0) -> anthropic.AsyncAnthropic:
    """One client per event loop: the async HTTP client is tied to the loop it first ran on."""
    key = id(asyncio.get_running_loop()) * 1000 + int(timeout)
    if key not in _clients:
        _clients[key] = anthropic.AsyncAnthropic(
            api_key=get_settings().anthropic_api_key, timeout=timeout, max_retries=1
        )
    return _clients[key]
