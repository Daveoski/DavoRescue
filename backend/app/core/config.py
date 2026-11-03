from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    jwt_ttl_hours: int
    anthropic_api_key: str
    ai_model: str
    ip_hash_salt: str
    responder_invite_code: str
    site_url: str
    osrm_url: str
    nominatim_url: str
    # Dispatch. "test" routes every outbound SMS/email to DISPATCH_TEST_RECIPIENTS
    # instead of the agencies, so nobody pages a real control room by accident.
    dispatch_mode: str
    dispatch_test_phones: tuple[str, ...]
    dispatch_test_emails: tuple[str, ...]
    resend_api_key: str
    dispatch_from_email: str
    termii_api_key: str
    termii_sender_id: str
    termii_channel: str
    dispatch_webhook_url: str
    dispatch_webhook_secret: str
    vapid_public_key: str
    vapid_private_key: str
    vapid_subject: str
    cors_origins: tuple[str, ...]
    # Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when it calls scheduled jobs.
    cron_secret: str

    @property
    def ai_enabled(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def push_enabled(self) -> bool:
        return bool(self.vapid_public_key and self.vapid_private_key)

    @property
    def live_dispatch(self) -> bool:
        return self.dispatch_mode == "live"


def _split(value: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in value.split(",") if part.strip())


@lru_cache
def get_settings() -> Settings:
    site_url = _env("SITE_URL", "https://davorescue.vercel.app").rstrip("/")
    return Settings(
        database_url=_env("DATABASE_URL") or _env("POSTGRES_URL"),
        jwt_secret=_env("JWT_SECRET", "dev-only-secret-change-me"),
        jwt_ttl_hours=int(_env("JWT_TTL_HOURS", "168")),
        anthropic_api_key=_env("ANTHROPIC_API_KEY"),
        ai_model=_env("AI_MODEL", "claude-opus-5-5"),
        ip_hash_salt=_env("IP_HASH_SALT", "dev-salt"),
        responder_invite_code=_env("RESPONDER_INVITE_CODE"),
        site_url=site_url,
        osrm_url=_env("OSRM_URL", "https://router.project-osrm.org").rstrip("/"),
        nominatim_url=_env("NOMINATIM_URL", "https://nominatim.openstreetmap.org").rstrip("/"),
        dispatch_mode=_env("DISPATCH_MODE", "test").lower(),
        dispatch_test_phones=_split(_env("DISPATCH_TEST_PHONES")),
        dispatch_test_emails=_split(_env("DISPATCH_TEST_EMAILS")),
        resend_api_key=_env("RESEND_API_KEY"),
        dispatch_from_email=_env("DISPATCH_FROM_EMAIL", "DavoRescue Dispatch <dispatch@davorescue.ng>"),
        termii_api_key=_env("TERMII_API_KEY"),
        termii_sender_id=_env("TERMII_SENDER_ID", "DavoRescue"),
        termii_channel=_env("TERMII_CHANNEL", "dnd"),
        dispatch_webhook_url=_env("DISPATCH_WEBHOOK_URL"),
        dispatch_webhook_secret=_env("DISPATCH_WEBHOOK_SECRET"),
        vapid_public_key=_env("VAPID_PUBLIC_KEY"),
        vapid_private_key=_env("VAPID_PRIVATE_KEY"),
        vapid_subject=_env("VAPID_SUBJECT", f"{site_url}/contact"),
        cors_origins=_split(_env("CORS_ORIGINS", "http://localhost:3000,https://localhost")),
        cron_secret=_env("CRON_SECRET"),
    )
