"""Trip guardian: if a traveller doesn't check in by their expected arrival, their contacts hear about it."""

from __future__ import annotations

import logging
import secrets
import time
from datetime import UTC, datetime, timedelta, timezone

import asyncpg
from fastapi import HTTPException, status

from app.core import http
from app.core.config import get_settings
from app.core.geo import maps_link
from app.domains.alerts.service import push_to_user
from app.domains.auth.schemas import UserOut
from app.domains.dispatch.channels import send_sms
from app.domains.roadpulse.schemas import TripIn

log = logging.getLogger("davorescue.trips")

GRACE = timedelta(minutes=15)  # after the ETA, before contacts are alerted
SWEEP_EVERY_S = 60
WAT = timezone(timedelta(hours=1), "WAT")

_last_sweep = 0.0


def trip_state(row: dict, now: datetime) -> str:
    if row["status"] != "active":
        return row["status"]
    if now > row["eta"] + GRACE:
        return "overdue"
    if now > row["eta"]:
        return "due"
    return "on_the_way"


def share_url(token: str) -> str:
    return f"{get_settings().site_url}/trip/{token}"


def owner_view(row: dict, now: datetime | None = None) -> dict:
    now = now or datetime.now(UTC)
    return {
        "id": str(row["id"]),
        "destination": row["destination"],
        "eta": row["eta"],
        "state": trip_state(row, now),
        "contacts": row["contacts"],
        "share_url": share_url(row["share_token"]),
        "last_seen_at": row["last_seen_at"],
        "created_at": row["created_at"],
    }


def public_view(row: dict, traveller: str, now: datetime | None = None) -> dict:
    """What a contact sees: first name only, and the last position the phone sent."""
    now = now or datetime.now(UTC)
    return {
        "traveller": traveller.split()[0],
        "destination": row["destination"],
        "eta": row["eta"],
        "state": trip_state(row, now),
        "started_at": row["created_at"],
        "ended_at": row["ended_at"],
        "last_position": {"lat": row["last_lat"], "lng": row["last_lng"]} if row["last_lat"] is not None else None,
        "last_seen_at": row["last_seen_at"],
    }


async def start(conn: asyncpg.Connection, user: UserOut, data: TripIn) -> dict:
    # One trip at a time: starting a new one closes the previous.
    await conn.execute(
        "update trips set status = 'cancelled', ended_at = now() where user_id = $1::uuid and status = 'active'", user.id
    )
    row = await conn.fetchrow(
        """insert into trips (user_id, share_token, destination, eta, contacts, last_lat, last_lng, last_seen_at)
           values ($1::uuid, $2, $3, now() + make_interval(mins => $4), $5, $6, $7,
                   case when $6::double precision is null then null else now() end)
           returning *""",
        user.id, secrets.token_urlsafe(9), data.destination, data.eta_minutes,
        [c.model_dump() for c in data.contacts], user.last_lat, user.last_lng,
    )
    return owner_view(dict(row))


async def _own(conn: asyncpg.Connection, user: UserOut, trip_id: str) -> dict:
    row = await conn.fetchrow("select * from trips where id = $1::uuid and user_id = $2::uuid", trip_id, user.id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    return dict(row)


async def active(conn: asyncpg.Connection, user: UserOut) -> dict | None:
    row = await conn.fetchrow(
        "select * from trips where user_id = $1::uuid and status = 'active' order by created_at desc limit 1", user.id
    )
    return owner_view(dict(row)) if row else None


async def ping(conn: asyncpg.Connection, user: UserOut, trip_id: str, lat: float, lng: float) -> dict:
    await _own(conn, user, trip_id)
    row = await conn.fetchrow(
        """update trips set last_lat = $3, last_lng = $4, last_seen_at = now()
           where id = $1::uuid and user_id = $2::uuid returning *""",
        trip_id, user.id, lat, lng,
    )
    return owner_view(dict(row))


async def finish(conn: asyncpg.Connection, user: UserOut, trip_id: str, outcome: str) -> dict:
    trip = await _own(conn, user, trip_id)
    row = await conn.fetchrow(
        "update trips set status = $2, ended_at = now() where id = $1::uuid returning *", trip_id, outcome
    )
    if outcome == "arrived" and trip["overdue_alerted_at"]:
        # Contacts were told to worry; tell them it's fine.
        await _text_contacts(conn, dict(row), f"DavoRescue: {user.full_name.split()[0]} has arrived safely at "
                                               f"{trip['destination']}. Thank you for looking out.")
    return owner_view(dict(row))


async def extend(conn: asyncpg.Connection, user: UserOut, trip_id: str, minutes: int) -> dict:
    await _own(conn, user, trip_id)
    row = await conn.fetchrow(
        """update trips set eta = greatest(eta, now()) + make_interval(mins => $2), reminded_at = null
           where id = $1::uuid and status = 'active' returning *""",
        trip_id, minutes,
    )
    if not row:
        raise HTTPException(status.HTTP_409_CONFLICT, "This trip has already ended")
    return owner_view(dict(row))


async def shared(conn: asyncpg.Connection, token: str) -> dict:
    row = await conn.fetchrow(
        "select t.*, u.full_name from trips t join users u on u.id = t.user_id where t.share_token = $1", token
    )
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This trip link isn't valid")
    return public_view(dict(row), row["full_name"])


async def _text_contacts(conn: asyncpg.Connection, trip: dict, message: str) -> list[dict]:
    results = []
    async with http.client(timeout=8.0) as client:
        for contact in trip["contacts"]:
            outcome, detail = await send_sms(client, contact["phone"], message)
            results.append({"to": contact["name"], "status": outcome, "detail": detail, "at": datetime.now(UTC).isoformat()})
    await conn.execute(
        "update trips set alert_log = alert_log || $2::jsonb where id = $1", trip["id"], results
    )
    return results


async def sweep(conn: asyncpg.Connection) -> dict:
    """Remind travellers at their ETA; alert contacts once they're overdue."""
    reminded = alerted = 0
    due = await conn.fetch(
        """update trips set reminded_at = now()
           where status = 'active' and reminded_at is null and eta < now() returning id, user_id, destination"""
    )
    for t in due:
        devices = await push_to_user(
            conn, str(t["user_id"]), title="Are you there yet?",
            body=f"You planned to reach {t['destination']} by now. Tap to tell your contacts you're safe, or add time.",
            url="/trip", tag=f"trip-{t['id']}",
        )
        reminded += 1 if devices else 0

    overdue = await conn.fetch(
        """update trips t set overdue_alerted_at = now()
           from users u
           where u.id = t.user_id and t.status = 'active' and t.overdue_alerted_at is null and t.eta + $1 < now()
           returning t.*, u.full_name""",
        GRACE,
    )
    for t in overdue:
        trip = dict(t)
        name = trip["full_name"].split()[0]
        where = (
            f" Last seen {maps_link(trip['last_lat'], trip['last_lng'])}"
            if trip["last_lat"] is not None else ""
        )
        await _text_contacts(
            conn, trip,
            f"DavoRescue: {name} hasn't checked in from a trip to {trip['destination']} (due "
            f"{trip['eta'].astimezone(WAT):%H:%M}).{where} Track: {share_url(trip['share_token'])} "
            "If you can't reach them, call 112.",
        )
        alerted += 1
    return {"reminded": reminded, "overdue_alerted": alerted}


async def maybe_sweep(conn: asyncpg.Connection) -> None:
    """Run the sweep at most once a minute per server, piggybacking on normal traffic.
    A minute-level external cron calling /api/pulse/sweep makes it independent of traffic."""
    global _last_sweep
    if time.monotonic() - _last_sweep < SWEEP_EVERY_S:
        return
    _last_sweep = time.monotonic()
    try:
        await sweep(conn)
    except Exception:  # noqa: BLE001 — never break the request that triggered it
        log.exception("trip sweep failed")
