"""SMS and email to a traveller's contacts: trip started, overdue, arrived."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta, timezone
from html import escape
from typing import Literal

import asyncpg

from app.core import http
from app.core.geo import maps_link
from app.domains.dispatch.channels import send_email, send_sms

Event = Literal["started", "overdue", "arrived"]
WAT = timezone(timedelta(hours=1), "WAT")
SMS_NOTE_LIMIT = 70  # keeps a started-trip SMS to about two pages


def _time(dt: datetime) -> str:
    return dt.astimezone(WAT).strftime("%H:%M")


def sms_text(event: Event, name: str, trip: dict, url: str) -> str:
    if event == "started":
        note = trip.get("message") or ""
        if len(note) > SMS_NOTE_LIMIT:
            note = note[: SMS_NOTE_LIMIT - 1].rstrip() + "…"
        quoted = f' "{note}"' if note else ""
        return f"{name} is travelling to {trip['destination']}, due {_time(trip['eta'])}.{quoted} Follow live: {url} -DavoRescue"
    if event == "overdue":
        where = f" Last seen: {maps_link(trip['last_lat'], trip['last_lng'])}" if trip.get("last_lat") is not None else ""
        return (
            f"DavoRescue: {name} hasn't checked in from a trip to {trip['destination']} (due {_time(trip['eta'])}).{where} "
            f"Track: {url} If you can't reach {name}, call 112."
        )
    return f"DavoRescue: {name} has arrived safely at {trip['destination']}. Thank you for looking out."


def _email_shell(heading: str, accent: str, body_html: str, url: str | None, button: str | None, recipient: str, name: str) -> str:
    cta = (
        f"<p style='margin:24px 0'><a href='{escape(url)}' style='background:{accent};color:#fff;text-decoration:none;"
        f"padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block'>{escape(button)}</a></p>"
        if url and button else ""
    )
    return (
        "<div style='font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#16181d'>"
        "<p style='font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f76;margin:0 0 8px'>"
        "DavoRescue trip guardian</p>"
        f"<h1 style='font-size:22px;margin:0 0 12px'>{escape(heading)}</h1>"
        f"{body_html}{cta}"
        f"<p style='font-size:12px;color:#6b6f76;margin-top:28px'>Hi {escape(recipient)}, you're getting this because "
        f"{escape(name)} added you as a trip contact on DavoRescue. If someone is in danger, call 112.</p>"
        "</div>"
    )


def email_message(event: Event, name: str, recipient: str, trip: dict, url: str) -> tuple[str, str, str]:
    """(subject, html, text)"""
    dest, due = trip["destination"], _time(trip["eta"])
    if event == "started":
        note = trip.get("message")
        note_html = (
            f"<blockquote style='margin:16px 0;padding:12px 16px;border-left:4px solid #f2a93b;background:#f3f0e9'>"
            f"{escape(note)}</blockquote>" if note else ""
        )
        html = _email_shell(
            f"{name} is travelling to {dest}",
            "#d63a1f",
            f"<p>{escape(name)} started a trip and expects to arrive by <strong>{due} WAT</strong>.</p>{note_html}"
            "<p>Tap below to follow their live location until they arrive. We'll tell you if they don't check in.</p>",
            url, "View live location", recipient, name,
        )
        text = f"{name} is travelling to {dest}, expected by {due} WAT.\n" + (f'"{note}"\n' if note else "") + f"Follow live: {url}"
        return f"{name} is travelling to {dest} — follow their trip", html, text

    if event == "overdue":
        last = (
            f"<p>Last position: <a href='{maps_link(trip['last_lat'], trip['last_lng'])}'>open in Google Maps</a></p>"
            if trip.get("last_lat") is not None else ""
        )
        html = _email_shell(
            f"{name} hasn't checked in",
            "#c4241a",
            f"<p>{escape(name)} expected to reach <strong>{escape(dest)}</strong> by {due} WAT and hasn't checked in.</p>{last}"
            f"<p>Try calling them. If you can't reach them and you're worried, call <strong>112</strong> and share their "
            "last location.</p>",
            url, "See last location", recipient, name,
        )
        text = f"{name} hasn't checked in from a trip to {dest} (due {due} WAT). Track: {url}. If you can't reach them, call 112."
        return f"{name} hasn't checked in from their trip", html, text

    html = _email_shell(
        f"{name} arrived safely", "#15805a",
        f"<p>{escape(name)} has arrived at <strong>{escape(dest)}</strong>. Thank you for looking out.</p>",
        None, None, recipient, name,
    )
    return f"{name} arrived safely", html, f"{name} has arrived safely at {dest}."


async def notify_contacts(conn: asyncpg.Connection, trip: dict, event: Event, traveller: str, url: str) -> list[dict]:
    """Text and email every contact; append what happened to the trip's log and return it."""
    name = traveller.split()[0]
    jobs, labels = [], []
    async with http.client(timeout=10.0) as client:
        for contact in trip["contacts"]:
            jobs.append(send_sms(client, contact["phone"], sms_text(event, name, trip, url)))
            labels.append((contact["name"], "sms"))
            if contact.get("email"):
                subject, html, text = email_message(event, name, contact["name"], trip, url)
                jobs.append(send_email(client, contact["email"], subject, html, text))
                labels.append((contact["name"], "email"))
        outcomes = await asyncio.gather(*jobs)

    now = datetime.now(UTC).isoformat()
    log = [
        {"event": event, "to": who, "channel": channel, "status": status, "detail": detail, "at": now}
        for (who, channel), (status, detail) in zip(labels, outcomes, strict=True)
    ]
    if log:
        await conn.execute("update trips set alert_log = alert_log || $2::jsonb where id = $1", trip["id"], log)
    return log
