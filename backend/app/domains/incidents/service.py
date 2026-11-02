"""Report intake: locate → corroborate → verify → dispatch → alert."""

from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import re
from datetime import UTC, datetime, timedelta, timezone

import asyncpg
from fastapi import HTTPException, status

from app.core.geo import haversine_m
from app.core.security import new_incident_ref
from app.domains.agencies.repository import list_agencies
from app.domains.alerts.service import push_incident
from app.domains.auth.schemas import UserOut
from app.domains.dispatch.service import dispatch_incident
from app.domains.incidents import repository as repo
from app.domains.incidents.schemas import IncidentIn, PhotoIn
from app.domains.roads.service import road_context
from app.domains.verification.schemas import EvidencePhoto, VerificationInput, VerificationResult
from app.domains.verification.service import verify

WAT = timezone(timedelta(hours=1), "WAT")  # Nigeria has no daylight saving
_DATA_URL = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$")
_MAGIC = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG", "image/webp": b"RIFF"}
MAX_PHOTO_BYTES = 2_000_000

ANON_LIMIT = (4, 10)  # reports per minutes
USER_LIMIT = (8, 10)


class DecodedPhoto:
    def __init__(self, photo: PhotoIn, mime: str, raw: bytes, b64: str):
        self.photo, self.mime, self.raw, self.b64 = photo, mime, raw, b64
        self.sha256 = hashlib.sha256(raw).hexdigest()


def decode_photo(photo: PhotoIn) -> DecodedPhoto:
    match = _DATA_URL.match(photo.data_url)
    if not match:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Photos must be JPEG, PNG or WebP images")
    mime, b64 = match.groups()
    try:
        raw = base64.b64decode(b64, validate=True)
    except binascii.Error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A photo could not be read")
    if len(raw) > MAX_PHOTO_BYTES or not raw.startswith(_MAGIC[mime]):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A photo is too large or not a real image")
    return DecodedPhoto(photo, mime, raw, b64)


async def _enforce_rate_limit(conn: asyncpg.Connection, fingerprint: str, user: UserOut | None) -> None:
    limit, minutes = USER_LIMIT if user else ANON_LIMIT
    recent = await repo.count_recent_reports(conn, fingerprint=fingerprint, user_id=user.id if user else None,
                                             minutes=minutes)
    if recent >= limit:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You've sent several reports in a few minutes. If lives are at risk, call 112 now.",
        )


def _call_list(agencies: list[dict], needs: list[str], category: str) -> list[dict]:
    """Numbers the reporter can tap to call right now, most relevant first."""
    wanted = set(needs) | {category}
    kinds_for = {"police": "crime", "security": None, "fire": "fire", "ambulance": "medical",
                 "frsc": "road", "nema": "disaster", "hotline": None}
    ranked = sorted(
        agencies,
        key=lambda a: (
            kinds_for.get(a["kind"]) in wanted or a["kind"] in ("security", "hotline") or category in a["categories"],
            a["priority"],
        ),
        reverse=True,
    )
    return [{"name": a["short_name"], "kind": a["kind"], "phones": a["phones"]} for a in ranked[:5]]


async def create_report(conn: asyncpg.Connection, data: IncidentIn, user: UserOut | None, fingerprint: str) -> dict:
    await _enforce_rate_limit(conn, fingerprint, user)
    photos = [decode_photo(p) for p in data.photos]
    reported_at = datetime.now(UTC)

    road = await road_context(data.lat, data.lng)
    known_hashes = await repo.known_photo_hashes(conn, [p.sha256 for p in photos])
    nearby = await repo.nearby_reports(conn, data.lat, data.lng, radius_m=2000, minutes=60)
    history = await repo.reporter_history(conn, user.id) if user else 0
    is_anonymous = data.anonymous or user is None

    incident_id = await conn.fetchval(
        """
        insert into incidents (ref, category, subtype, description, injured_count, lat, lng, accuracy_m,
                               road_name, road_class, navigability, access_lat, access_lng, access_distance_m,
                               address, lga, state, reporter_id, is_anonymous, reporter_contact, reporter_fingerprint)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::uuid, $19, $20, $21)
        returning id
        """,
        new_incident_ref(), data.category, data.subtype.lower(), data.description, data.injured_count,
        data.lat, data.lng, data.accuracy_m, road.road_name, road.road_class, road.navigability,
        road.access.lat if road.access else None, road.access.lng if road.access else None,
        road.access.distance_m if road.access else None, road.address, road.lga, road.state,
        user.id if user else None, is_anonymous,
        data.contact_phone or (user.phone if user and not is_anonymous else None), fingerprint,
    )
    await repo.add_event(conn, incident_id, "created", "Anonymous report" if is_anonymous else "Signed-in report",
                         None if is_anonymous else (user.id if user else None))

    if photos:
        await conn.executemany(
            """insert into incident_media (incident_id, mime, bytes, sha256, captured_at, capture_lat, capture_lng, live_capture)
               values ($1, $2, $3, $4, $5, $6, $7, $8)""",
            [(incident_id, p.mime, p.raw, p.sha256, p.photo.captured_at, p.photo.lat, p.photo.lng, p.photo.live_capture)
             for p in photos],
        )

    result = await verify(VerificationInput(
        category=data.category,
        subtype=data.subtype,
        description=data.description,
        lat=data.lat,
        lng=data.lng,
        accuracy_m=data.accuracy_m,
        location_summary=road.summary + (f", {road.lga}" if road.lga else "") + f", {road.state.title()}",
        reported_at_local=reported_at.astimezone(WAT).strftime("%A %d %B %Y, %H:%M WAT"),
        is_anonymous=is_anonymous,
        reporter_history=history,
        injured_count=data.injured_count,
        photos=[
            EvidencePhoto(
                mime=p.mime,
                data_b64=p.b64,
                live_capture=p.photo.live_capture,
                seconds_before_report=(reported_at - p.photo.captured_at).total_seconds()
                if p.photo.captured_at and p.photo.captured_at.tzinfo else None,
                metres_from_report=haversine_m(data.lat, data.lng, p.photo.lat, p.photo.lng)
                if p.photo.lat is not None and p.photo.lng is not None else None,
                previously_submitted=p.sha256 in known_hashes,
            )
            for p in photos
        ],
        nearby=nearby,
    ))

    incident = await _apply_verdict(conn, incident_id, result, corroboration=len(nearby))
    dispatches: list[dict] = []
    pushed = 0
    if result.verdict == "true":
        incident["location_summary"] = road.summary
        dispatches, pushed = await _dispatch_and_alert(conn, incident, result.needs, user.id if user else None)

    agencies = await list_agencies(conn, road.state if road.state != "other" else None)
    return {
        "ref": incident["ref"],
        "status": incident["status"],
        "verdict": result.verdict,
        "verification": {
            "source": result.source,
            "confidence": result.confidence,
            "severity": result.severity,
            "panic_score": result.panic_score,
            "category": result.category,
            "subtype": result.subtype,
            "summary": result.summary,
            "reasons": result.reasons,
            "red_flags": result.red_flags,
            "evidence_match": result.evidence_match,
        },
        "advice": result.reporter_advice,
        "public_alert": result.public_alert,
        "road": road.to_dict(),
        "dispatches": [{k: d[k] for k in ("agency_name", "channel", "status", "detail")} for d in dispatches],
        "people_alerted": pushed,
        "call_list": _call_list(agencies, result.needs, result.category),
    }


async def _apply_verdict(conn: asyncpg.Connection, incident_id, result: VerificationResult, corroboration: int) -> dict:
    new_status = "verified" if result.verdict == "true" else "rejected"
    row = await conn.fetchrow(
        """
        update incidents set
          status = $2, verdict = $3, verification_source = $4, confidence = $5, severity = $6, panic_score = $7,
          category = $8, subtype = $9, ai_summary = $10, ai_reasons = $11, ai_red_flags = $12, evidence_match = $13,
          public_alert = $14, dispatch_message = $15, reporter_advice = $16, corroboration_count = $17,
          verified_at = now(), updated_at = now()
        where id = $1 returning *
        """,
        incident_id, new_status, result.verdict, result.source, result.confidence, result.severity,
        result.panic_score, result.category, result.subtype, result.summary, result.reasons, result.red_flags,
        result.evidence_match, result.public_alert, result.dispatch_sms, result.reporter_advice, corroboration,
    )
    source = "AI desk" if result.source == "ai" else "keyword triage"
    await repo.add_event(conn, incident_id, new_status,
                         f"{source}: {result.verdict} ({result.confidence:.0%}) — {'; '.join(result.reasons)}")
    return dict(row)


async def _dispatch_and_alert(conn: asyncpg.Connection, incident: dict, needs: list[str], reporter_id: str | None):
    dispatches = await dispatch_incident(conn, incident, needs)
    sent = sum(1 for d in dispatches if d["status"] == "sent")
    if sent:
        await conn.execute("update incidents set status = 'dispatched', updated_at = now() where id = $1", incident["id"])
        incident["status"] = "dispatched"
    await repo.add_event(conn, incident["id"], "dispatched",
                         f"{sent} message(s) delivered, {len(dispatches) - sent} not delivered")
    try:
        pushed = await asyncio.wait_for(push_incident(conn, incident, exclude_user_id=reporter_id), timeout=12)
    except TimeoutError:
        pushed = 0
    if pushed:
        await repo.add_event(conn, incident["id"], "alerted", f"{pushed} nearby user(s) notified")
    return dispatches, pushed


async def update_status(conn: asyncpg.Connection, ref: str, new_status: str, note: str | None, actor: UserOut) -> dict:
    incident = await repo.get_by_ref(conn, ref)
    if not incident:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")

    overturned = incident["status"] == "rejected" and new_status in ("verified", "dispatched", "responding")
    await conn.execute(
        """
        update incidents set status = $2, updated_at = now(),
          verdict = case when $2 = 'rejected' then 'false' when $3 then 'true' else verdict end,
          verification_source = case when $2 = 'rejected' or $3 then 'human' else verification_source end,
          resolved_at = case when $2 = 'resolved' then now() else resolved_at end
        where id = $1
        """,
        incident["id"], new_status, overturned,
    )
    await repo.add_event(conn, incident["id"], new_status, note, actor.id)

    if overturned:
        # A responder has overruled the verdict: page the agencies now.
        refreshed = await repo.get_by_ref(conn, ref)
        assert refreshed is not None
        refreshed["location_summary"] = refreshed.get("road_name") or refreshed.get("address") or ""
        needs = {"crime": ["police"], "fire": ["fire"], "medical": ["ambulance"],
                 "road": ["road_safety", "ambulance"], "disaster": ["disaster"]}[refreshed["category"]]
        await _dispatch_and_alert(conn, refreshed, needs, None)

    detail = await repo.responder_detail(conn, ref)
    assert detail is not None
    return detail
