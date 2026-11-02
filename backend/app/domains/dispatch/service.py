from __future__ import annotations

import asyncio

import asyncpg

from app.core import http
from app.core.config import get_settings
from app.domains.agencies.repository import agencies_for
from app.domains.dispatch import channels, messages

# Cap fan-out so one incident can't burn the SMS budget.
MAX_SMS_PER_AGENCY = 2


async def dispatch_incident(conn: asyncpg.Connection, incident: dict, needs: list[str]) -> list[dict]:
    """Notify every responsible agency over every channel it has. Returns the dispatch log."""
    settings = get_settings()
    agencies = await agencies_for(conn, incident["state"], needs)
    sms = messages.sms_text(incident)
    subject = messages.email_subject(incident)

    jobs: list[tuple[dict | None, str, str]] = []
    async with http.client(timeout=8.0) as client:
        tasks = []

        def plan(agency: dict | None, channel: str, target: str, coro) -> None:
            tasks.append(coro)
            jobs.append((agency, channel, target))

        if settings.live_dispatch:
            for agency in agencies:
                for phone in agency["sms_phones"][:MAX_SMS_PER_AGENCY]:
                    plan(agency, "sms", phone, channels.send_sms(client, phone, sms))
                html, text = messages.email_bodies(incident, agency["name"])
                for email in agency["emails"]:
                    plan(agency, "email", email, channels.send_email(client, email, subject, html, text))
        else:
            # Test mode: show the agencies that *would* be paged, deliver only to test recipients.
            for agency in agencies:
                for phone in agency["sms_phones"][:MAX_SMS_PER_AGENCY]:
                    plan(agency, "sms", phone, _skip("Test mode — not sent to the agency"))
                for email in agency["emails"]:
                    plan(agency, "email", email, _skip("Test mode — not sent to the agency"))
            for phone in settings.dispatch_test_phones:
                plan(None, "sms", phone, channels.send_sms(client, phone, "[TEST] " + sms))
            html, text = messages.email_bodies(incident, "Test recipient")
            for email in settings.dispatch_test_emails:
                plan(None, "email", email, channels.send_email(client, email, "[TEST] " + subject, html, text))

        plan(None, "webhook", settings.dispatch_webhook_url or "—", channels.send_webhook(client, _payload(incident, needs)))
        results = await asyncio.gather(*tasks)

    log: list[dict] = []
    for (agency, channel, target), (status, detail) in zip(jobs, results, strict=True):
        if channel == "webhook" and status == "skipped":
            continue
        log.append({
            "agency_slug": agency["slug"] if agency else None,
            "agency_name": agency["short_name"] if agency else ("Test recipient" if channel != "webhook" else "Webhook"),
            "channel": channel,
            "target": target,
            "status": status,
            "detail": detail,
        })

    if log:
        await conn.executemany(
            "insert into dispatches (incident_id, agency_slug, channel, target, status, detail) values ($1, $2, $3, $4, $5, $6)",
            [(incident["id"], e["agency_slug"], e["channel"], e["target"], e["status"], e["detail"]) for e in log],
        )
    return log


async def _skip(reason: str) -> tuple[str, str]:
    return "skipped", reason


def _payload(incident: dict, needs: list[str]) -> dict:
    keys = (
        "ref", "category", "subtype", "severity", "panic_score", "verdict", "verification_source", "confidence",
        "lat", "lng", "accuracy_m", "road_name", "navigability", "access_lat", "access_lng", "lga", "state",
        "dispatch_message", "description", "reporter_contact", "created_at",
    )
    return {"event": "incident.verified", "needs": needs, "incident": {k: incident.get(k) for k in keys},
            "url": messages.incident_url(incident["ref"])}
