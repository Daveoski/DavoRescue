"""Early warnings and check-ins from drivers, verified by corroboration.

One report is a rumour; it stays private to responders. It becomes a public
warning when independent sources agree, a trusted reporter sends it, or a
responder confirms it.
"""

from __future__ import annotations

import asyncio
import uuid
from collections import Counter
from datetime import UTC, datetime

import asyncpg
from fastapi import HTTPException, status

from app.core.geo import bbox_around, haversine_m
from app.domains.alerts.service import push_nearby
from app.domains.auth.schemas import UserOut
from app.domains.incidents.service import create_confirmed_incident
from app.domains.roadpulse.schemas import ESCALATION, SIGN_LABELS, TTL, SignalIn
from app.domains.roadwatch.scoring import distance_to_path_m

CLUSTER_RADIUS_M = 1500
CORROBORATION_WINDOW_MIN = 30
TRUSTED_AFTER_VERIFIED = 2
SNAP_TO_ROAD_M = 500
RATE_LIMIT = (6, 10)  # signals per minutes

RANK = {"dismissed": -1, "unverified": 0, "corroborated": 1, "confirmed": 2}
PUBLIC = ("corroborated", "confirmed")


def cluster_status(sources: int, trusted: bool, responder: bool, best_existing: str | None) -> str:
    """Where a warning sits on the verification ladder."""
    if responder or best_existing == "confirmed":
        return "confirmed"
    if sources >= 2 or trusted or best_existing == "corroborated":
        return "corroborated"
    return "unverified"


def _source(row) -> str:
    return f"u:{row['reporter_id']}" if row["reporter_id"] else f"f:{row['reporter_fingerprint']}"


async def nearest_segment(conn: asyncpg.Connection, lat: float, lng: float) -> dict | None:
    pad = 0.006
    rows = await conn.fetch(
        """
        select id, corridor_name, label, path from road_segments
        where $1 between min_lat - $3 and max_lat + $3 and $2 between min_lng - $3 and max_lng + $3
        """,
        lat, lng, pad,
    )
    best = min(((distance_to_path_m(lat, lng, r["path"]), r) for r in rows), default=None, key=lambda t: t[0])
    if not best or best[0] > SNAP_TO_ROAD_M:
        return None
    r = best[1]
    return {"id": r["id"], "corridor_name": r["corridor_name"], "label": r["label"]}


async def _rate_limit(conn: asyncpg.Connection, fp: str, user: UserOut | None) -> None:
    limit, minutes = RATE_LIMIT
    recent = await conn.fetchval(
        """select count(*) from road_signals where created_at > now() - make_interval(mins => $3)
           and (reporter_fingerprint = $1 or ($2::uuid is not null and reporter_id = $2::uuid))""",
        fp, user.id if user else None, minutes,
    )
    if recent >= limit:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "You've sent several updates in a few minutes. Thank you — that's enough for now.")


async def _is_trusted(conn: asyncpg.Connection, user: UserOut | None) -> bool:
    if user is None:
        return False
    verified = await conn.fetchval(
        "select count(*) from incidents where reporter_id = $1::uuid and verdict = 'true'", user.id
    )
    return verified >= TRUSTED_AFTER_VERIFIED


async def _active_peers(conn: asyncpg.Connection, lat: float, lng: float) -> list[dict]:
    min_lat, max_lat, min_lng, max_lng = bbox_around(lat, lng, CLUSTER_RADIUS_M)
    rows = await conn.fetch(
        """
        select id, cluster_id, status, lat, lng, reporter_id, reporter_fingerprint, created_at from road_signals
        where kind <> 'all_clear' and status <> 'dismissed' and expires_at > now()
          and lat between $1 and $2 and lng between $3 and $4
        order by created_at desc
        """,
        min_lat, max_lat, min_lng, max_lng,
    )
    return [dict(r) for r in rows if haversine_m(lat, lng, r["lat"], r["lng"]) <= CLUSTER_RADIUS_M]


def _place(segment: dict | None) -> str:
    return f"{segment['corridor_name']} {segment['label']}" if segment else "a road near you"


async def record_signal(conn: asyncpg.Connection, data: SignalIn, user: UserOut | None, fp: str) -> dict:
    await _rate_limit(conn, fp, user)
    segment = await nearest_segment(conn, data.lat, data.lng)
    now = datetime.now(UTC)
    signal_id = uuid.uuid4()
    me = f"u:{user.id}" if user else f"f:{fp}"

    if data.kind == "all_clear":
        await _insert(conn, signal_id, signal_id, data, segment, user, fp, "unverified", now)
        return {"id": str(signal_id), "kind": data.kind, "status": "recorded", "segment": segment, "people_alerted": 0,
                "message": "Thanks — drivers behind you will see the road was clear just now."}

    peers = await _active_peers(conn, data.lat, data.lng)
    cluster_id = peers[0]["cluster_id"] if peers else signal_id
    window_start = now.timestamp() - CORROBORATION_WINDOW_MIN * 60
    sources = {_source(p) for p in peers if p["created_at"].timestamp() >= window_start} | {me}
    best_existing = max((p["status"] for p in peers), key=RANK.__getitem__, default=None)
    responder = bool(user and user.role in ("responder", "admin"))
    new_status = cluster_status(len(sources), await _is_trusted(conn, user), responder, best_existing)

    await _insert(conn, signal_id, cluster_id, data, segment, user, fp, new_status, now)
    # Merge nearby clusters into one and lift everything to the new status.
    if peers:
        await conn.execute(
            """update road_signals set cluster_id = $1,
                 status = case when status = 'dismissed' then status
                               when $3 = 'confirmed' or status = 'unverified' then $3 else status end
               where id = any($2::uuid[])""",
            cluster_id, [p["id"] for p in peers], new_status,
        )

    became_public = new_status in PUBLIC and best_existing not in PUBLIC
    alerted = 0
    if became_public:
        alerted = await _announce(conn, cluster_id, data, segment, len(sources), new_status, user)

    if new_status == "unverified":
        message = "Thanks. Responders can see this now. It becomes a public warning when another driver confirms it."
    elif became_public:
        message = (
            "Confirmed by responders — drivers nearby are being warned."
            if new_status == "confirmed"
            else f"Backed up by {len(sources)} independent sources — drivers nearby are being warned."
        )
    else:
        message = "Thanks — this adds weight to a warning already on this stretch."
    return {"id": str(signal_id), "kind": data.kind, "status": new_status, "sources": len(sources),
            "segment": segment, "people_alerted": alerted, "message": message}


async def _insert(conn, signal_id, cluster_id, data: SignalIn, segment, user, fp, status_, now) -> None:
    await conn.execute(
        """insert into road_signals (id, cluster_id, kind, sign, note, lat, lng, accuracy_m, segment_id, reporter_id,
                                     reporter_fingerprint, status, created_at, expires_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $11, $12, $13, $14)""",
        signal_id, cluster_id, data.kind, data.sign, data.note, data.lat, data.lng, data.accuracy_m,
        segment["id"] if segment else None, user.id if user else None, fp, status_, now, now + TTL[data.kind],
    )


async def _announce(conn, cluster_id, data: SignalIn, segment, sources: int, status_: str, user) -> int:
    what = SIGN_LABELS[data.sign or data.kind]
    confirmed = status_ == "confirmed"
    try:
        return await asyncio.wait_for(
            push_nearby(
                conn, data.lat, data.lng,
                title=f"{'Danger' if confirmed else 'Possible danger'} ahead · {_place(segment)}",
                body=f"{what}. {'Confirmed by responders' if confirmed else f'Reported by {sources} sources, not yet confirmed'}. "
                     "Slow down, or wait before travelling this stretch.",
                url=f"/roads?warning={cluster_id}",
                tag=f"warning-{cluster_id}",
                severity=4 if confirmed else 3,
                exclude_user_id=user.id if user else None,
            ),
            timeout=10,
        )
    except TimeoutError:
        return 0


async def clusters(conn: asyncpg.Connection, *, include_private: bool = False, hours: int = 2) -> list[dict]:
    """Active warnings grouped by cluster. The public only sees corroborated and confirmed ones."""
    rows = await conn.fetch(
        """
        select s.*, g.corridor_name, g.label as segment_label, u.full_name as reporter_name
        from road_signals s
        left join road_segments g on g.id = s.segment_id
        left join users u on u.id = s.reporter_id
        where s.kind <> 'all_clear' and s.created_at > now() - make_interval(hours => $1)
          and ($2 or (s.expires_at > now() and s.status = any($3::text[])))
        order by s.created_at
        """,
        hours, include_private, list(PUBLIC),
    )
    grouped: dict = {}
    for r in rows:
        grouped.setdefault(r["cluster_id"], []).append(dict(r))

    out = []
    for cid, items in grouped.items():
        best = max(items, key=lambda i: RANK[i["status"]])["status"]
        segments = Counter((i["segment_id"], i["corridor_name"], i["segment_label"]) for i in items if i["segment_id"])
        seg = segments.most_common(1)[0][0] if segments else None
        cluster = {
            "id": str(cid),
            "status": best,
            "signs": sorted({i["sign"] or i["kind"] for i in items}),
            "sources": len({_source(i) for i in items}),
            "lat": round(sum(i["lat"] for i in items) / len(items), 4),
            "lng": round(sum(i["lng"] for i in items) / len(items), 4),
            "segment": {"id": seg[0], "corridor_name": seg[1], "label": seg[2]} if seg else None,
            "first_seen": items[0]["created_at"],
            "last_seen": items[-1]["created_at"],
            "expires_at": max(i["expires_at"] for i in items),
        }
        if include_private:
            cluster["reports"] = [
                {"kind": i["kind"], "sign": i["sign"], "note": i["note"], "status": i["status"],
                 "reporter": i["reporter_name"] or "Anonymous", "created_at": i["created_at"],
                 "lat": i["lat"], "lng": i["lng"]}
                for i in items
            ]
            cluster["incident_id"] = next((str(i["incident_id"]) for i in items if i["incident_id"]), None)
        out.append(cluster)
    out.sort(key=lambda c: (RANK[c["status"]], c["last_seen"]), reverse=True)
    return out


async def segment_pulse(conn: asyncpg.Connection) -> dict[str, dict]:
    """Recent check-ins per stretch: all-clears in the last 3 h, vehicles turning back in the last hour."""
    rows = await conn.fetch(
        """
        select segment_id,
               count(*) filter (where kind = 'all_clear') as all_clear,
               max(created_at) filter (where kind = 'all_clear') as last_all_clear,
               count(*) filter (where kind = 'turning_back' and created_at > now() - interval '1 hour') as turning_back
        from road_signals
        where segment_id is not null and status <> 'dismissed' and created_at > now() - interval '3 hours'
        group by segment_id
        """
    )
    return {r["segment_id"]: dict(r) for r in rows}


async def review(conn: asyncpg.Connection, cluster_id: str, action: str, note: str | None, actor: UserOut) -> dict:
    items = await conn.fetch("select * from road_signals where cluster_id = $1::uuid order by created_at", cluster_id)
    if not items:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Warning not found")
    was_public = any(i["status"] in PUBLIC for i in items)
    new_status = "dismissed" if action == "dismiss" else "confirmed"
    await conn.execute(
        "update road_signals set status = $2, reviewed_by = $3::uuid where cluster_id = $1::uuid",
        cluster_id, new_status, actor.id,
    )

    result: dict = {"id": cluster_id, "status": new_status}
    latest = dict(items[-1])
    if new_status == "confirmed" and not was_public:
        segment = await nearest_segment(conn, latest["lat"], latest["lng"])
        data = SignalIn(kind=latest["kind"], sign=latest["sign"], lat=latest["lat"], lng=latest["lng"])
        result["people_alerted"] = await _announce(conn, cluster_id, data, segment, len({_source(i) for i in items}),
                                                   "confirmed", None)

    if action == "escalate":
        sign = next((i["sign"] for i in items if i["sign"]), None) or latest["kind"]
        category, subtype, severity = ESCALATION[sign]
        notes = "; ".join(i["note"] for i in items if i["note"])
        description = f"{SIGN_LABELS[sign]} — reported by {len({_source(i) for i in items})} source(s)"
        description += f". {notes}" if notes else ""
        if note:
            description += f". Responder: {note}"
        incident = await create_confirmed_incident(
            conn, category=category, subtype=subtype, description=description, lat=latest["lat"], lng=latest["lng"],
            severity=severity, public_alert=f"{SIGN_LABELS[sign]} confirmed nearby. Avoid the area if you can.",
            actor=actor,
        )
        await conn.execute("update road_signals set incident_id = $2 where cluster_id = $1::uuid", cluster_id, incident["id"])
        result["incident_ref"] = incident["ref"]
    return result
