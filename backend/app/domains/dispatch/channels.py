"""Outbound channels. Each returns (status, detail) and never raises."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Literal

import httpx

from app.core import http
from app.core.config import get_settings

SendStatus = Literal["sent", "failed", "skipped"]


def to_international(phone: str) -> str | None:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits.startswith("234") and len(digits) == 13:
        return digits
    if digits.startswith("0") and len(digits) == 11:
        return "234" + digits[1:]
    return None  # short codes (112, 122) and landlines cannot receive SMS


async def send_sms(client: httpx.AsyncClient, phone: str, message: str) -> tuple[SendStatus, str]:
    settings = get_settings()
    if not settings.termii_api_key:
        return "skipped", "SMS provider not configured (TERMII_API_KEY)"
    number = to_international(phone)
    if not number:
        return "skipped", "Not an SMS-capable mobile number"
    try:
        res = await client.post(
            "https://api.ng.termii.com/api/sms/send",
            json={
                "api_key": settings.termii_api_key,
                "to": number,
                "from": settings.termii_sender_id,
                "sms": message,
                "type": "plain",
                "channel": settings.termii_channel,
            },
        )
        body = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
    except httpx.HTTPError as exc:
        return "failed", f"SMS gateway unreachable: {exc.__class__.__name__}"
    if res.is_success and body.get("message_id"):
        return "sent", f"termii:{body['message_id']}"
    return "failed", f"termii {res.status_code}: {str(body.get('message') or res.text)[:160]}"


async def send_email(client: httpx.AsyncClient, to: str, subject: str, html: str, text: str) -> tuple[SendStatus, str]:
    settings = get_settings()
    if not settings.resend_api_key:
        return "skipped", "Email provider not configured (RESEND_API_KEY)"
    try:
        res = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.dispatch_from_email, "to": [to], "subject": subject, "html": html, "text": text},
        )
    except httpx.HTTPError as exc:
        return "failed", f"Email gateway unreachable: {exc.__class__.__name__}"
    if res.is_success:
        return "sent", f"resend:{res.json().get('id', '')}"
    return "failed", f"resend {res.status_code}: {res.text[:160]}"


async def send_webhook(client: httpx.AsyncClient, payload: dict) -> tuple[SendStatus, str]:
    """For control rooms that integrate directly (e.g. a CAD system)."""
    settings = get_settings()
    if not settings.dispatch_webhook_url:
        return "skipped", "No webhook configured"
    body = json.dumps(payload, separators=(",", ":"), default=str).encode()
    headers = {"Content-Type": "application/json", "User-Agent": http.user_agent()}
    if settings.dispatch_webhook_secret:
        digest = hmac.new(settings.dispatch_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        headers["X-DavoRescue-Signature"] = f"sha256={digest}"
    try:
        res = await client.post(settings.dispatch_webhook_url, content=body, headers=headers)
    except httpx.HTTPError as exc:
        return "failed", f"Webhook unreachable: {exc.__class__.__name__}"
    return ("sent", f"HTTP {res.status_code}") if res.is_success else ("failed", f"HTTP {res.status_code}")
