from __future__ import annotations

import asyncpg

from app.core.geo import bbox_around, haversine_m

PUBLIC_STATUSES = ("verified", "dispatched", "responding", "resolved")

_PUBLIC_COLUMNS = """
  i.id, i.ref, i.category, i.subtype, i.severity, i.status, i.verdict, i.public_alert, i.road_name,
  i.navigability, i.lga, i.state, i.lat, i.lng, i.created_at, i.verified_at, i.resolved_at,
  i.corroboration_count,
  coalesce((select array_agg(distinct a.short_name) from dispatches d join agencies a on a.slug = d.agency_slug
            where d.incident_id = i.id and d.status = 'sent'), '{}') as agencies_notified
"""


def public_view(row: asyncpg.Record | dict) -> dict:
    r = dict(row)
    return {
        "ref": r["ref"],
        "category": r["category"],
        "subtype": r["subtype"],
        "severity": r["severity"],
        "status": r["status"],
        "verified": r["verdict"] == "true",
        "alert": r["public_alert"],
        "road_name": r["road_name"],
        "navigability": r["navigability"],
        "lga": r["lga"],
        "state": r["state"],
        "lat": round(r["lat"], 5),
        "lng": round(r["lng"], 5),
        "created_at": r["created_at"],
        "verified_at": r["verified_at"],
        "resolved_at": r["resolved_at"],
        "corroboration_count": r["corroboration_count"],
        "agencies_notified": list(r["agencies_notified"] or []),
    }


async def count_recent_reports(conn: asyncpg.Connection, *, fingerprint: str, user_id: str | None, minutes: int) -> int:
    return await conn.fetchval(
        """
        select count(*) from incidents
        where created_at > now() - make_interval(mins => $3)
          and (reporter_fingerprint = $1 or ($2::uuid is not null and reporter_id = $2::uuid))
        """,
        fingerprint, user_id, minutes,
    )


async def reporter_history(conn: asyncpg.Connection, user_id: str) -> int:
    return await conn.fetchval("select count(*) from incidents where reporter_id = $1::uuid", user_id)


async def nearby_reports(
    conn: asyncpg.Connection, lat: float, lng: float, *, radius_m: float, minutes: int, exclude_id=None
) -> list[dict]:
    min_lat, max_lat, min_lng, max_lng = bbox_around(lat, lng, radius_m)
    rows = await conn.fetch(
        """
        select id, category, subtype, lat, lng, extract(epoch from now() - created_at) / 60 as minutes_ago
        from incidents
        where created_at > now() - make_interval(mins => $5)
          and lat between $1 and $2 and lng between $3 and $4
          and ($6::uuid is null or id <> $6::uuid)
          and coalesce(verdict, 'true') = 'true'
        order by created_at desc limit 20
        """,
        min_lat, max_lat, min_lng, max_lng, minutes, exclude_id,
    )
    out = []
    for r in rows:
        distance = haversine_m(lat, lng, r["lat"], r["lng"])
        if distance <= radius_m:
            out.append({"category": r["category"], "subtype": r["subtype"], "distance_m": distance,
                        "minutes_ago": float(r["minutes_ago"])})
    return out


async def known_photo_hashes(conn: asyncpg.Connection, hashes: list[str]) -> set[str]:
    if not hashes:
        return set()
    rows = await conn.fetch("select distinct sha256 from incident_media where sha256 = any($1::text[])", hashes)
    return {r["sha256"] for r in rows}


async def add_event(conn: asyncpg.Connection, incident_id, kind: str, note: str | None = None, actor_id=None) -> None:
    await conn.execute(
        "insert into incident_events (incident_id, actor_id, kind, note) values ($1, $2::uuid, $3, $4)",
        incident_id, actor_id, kind, note,
    )


async def get_by_ref(conn: asyncpg.Connection, ref: str) -> dict | None:
    row = await conn.fetchrow("select * from incidents where ref = $1", ref.upper())
    return dict(row) if row else None


async def get_public(conn: asyncpg.Connection, ref: str) -> dict | None:
    row = await conn.fetchrow(
        f"select {_PUBLIC_COLUMNS} from incidents i where i.ref = $1 and i.status = any($2::text[])",
        ref.upper(), list(PUBLIC_STATUSES),
    )
    return public_view(row) if row else None


async def list_public(conn: asyncpg.Connection, *, hours: int, state: str | None, limit: int = 300) -> list[dict]:
    rows = await conn.fetch(
        f"""
        select {_PUBLIC_COLUMNS} from incidents i
        where i.status = any($1::text[]) and i.created_at > now() - make_interval(hours => $2)
          and ($3::text is null or i.state = $3)
        order by i.created_at desc limit $4
        """,
        list(PUBLIC_STATUSES), hours, state, limit,
    )
    return [public_view(r) for r in rows]


async def incidents_near(conn: asyncpg.Connection, lat: float, lng: float, radius_m: float, hours: int) -> list[dict]:
    min_lat, max_lat, min_lng, max_lng = bbox_around(lat, lng, radius_m)
    rows = await conn.fetch(
        f"""
        select {_PUBLIC_COLUMNS} from incidents i
        where i.status = any($1::text[]) and i.created_at > now() - make_interval(hours => $2)
          and i.lat between $3 and $4 and i.lng between $5 and $6
        order by i.created_at desc limit 200
        """,
        list(PUBLIC_STATUSES), hours, min_lat, max_lat, min_lng, max_lng,
    )
    items = []
    for r in rows:
        distance = haversine_m(lat, lng, r["lat"], r["lng"])
        if distance <= radius_m:
            items.append({**public_view(r), "distance_m": round(distance)})
    return items


async def responder_list(conn: asyncpg.Connection, *, statuses: list[str] | None, hours: int, state: str | None) -> list[dict]:
    rows = await conn.fetch(
        """
        select i.ref, i.category, i.subtype, i.severity, i.panic_score, i.status, i.verdict, i.verification_source,
               i.confidence, i.ai_summary, i.road_name, i.navigability, i.lga, i.state, i.lat, i.lng,
               i.is_anonymous, i.corroboration_count, i.created_at,
               (select count(*) from incident_media m where m.incident_id = i.id) as photo_count
        from incidents i
        where i.created_at > now() - make_interval(hours => $1)
          and ($2::text[] is null or i.status = any($2::text[]))
          and ($3::text is null or i.state = $3)
        order by (i.status in ('received', 'verified', 'dispatched', 'responding')) desc,
                 i.severity desc nulls last, i.created_at desc
        limit 300
        """,
        hours, statuses, state,
    )
    return [dict(r) for r in rows]


async def responder_detail(conn: asyncpg.Connection, ref: str) -> dict | None:
    incident = await get_by_ref(conn, ref)
    if not incident:
        return None
    reporter = None
    if incident["reporter_id"] and not incident["is_anonymous"]:
        row = await conn.fetchrow("select full_name, phone from users where id = $1", incident["reporter_id"])
        reporter = dict(row) if row else None
    media = await conn.fetch(
        """select id::text, mime, captured_at, capture_lat, capture_lng, live_capture
           from incident_media where incident_id = $1 order by created_at""",
        incident["id"],
    )
    dispatches = await conn.fetch(
        """select d.channel, d.target, d.status, d.detail, d.created_at, d.agency_slug, a.short_name as agency_name
           from dispatches d left join agencies a on a.slug = d.agency_slug
           where d.incident_id = $1 order by d.created_at""",
        incident["id"],
    )
    events = await conn.fetch(
        """select e.kind, e.note, e.created_at, u.full_name as actor
           from incident_events e left join users u on u.id = e.actor_id
           where e.incident_id = $1 order by e.created_at""",
        incident["id"],
    )
    incident.pop("reporter_fingerprint", None)
    incident["id"] = str(incident["id"])
    incident["reporter_id"] = str(incident["reporter_id"]) if incident["reporter_id"] else None
    return {
        **incident,
        "reporter": reporter,
        "media": [dict(m) for m in media],
        "dispatches": [dict(d) for d in dispatches],
        "events": [dict(e) for e in events],
    }


async def get_media(conn: asyncpg.Connection, ref: str, media_id: str) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """select m.mime, m.bytes from incident_media m join incidents i on i.id = m.incident_id
           where i.ref = $1 and m.id = $2::uuid""",
        ref.upper(), media_id,
    )


async def stats(conn: asyncpg.Connection) -> dict:
    row = await conn.fetchrow(
        """
        select
          count(*) filter (where created_at > now() - interval '24 hours') as reports_24h,
          count(*) filter (where verdict = 'true' and created_at > now() - interval '30 days') as verified_30d,
          count(*) filter (where verdict = 'false' and created_at > now() - interval '30 days') as rejected_30d,
          percentile_cont(0.5) within group (order by extract(epoch from verified_at - created_at))
            filter (where verified_at is not null and created_at > now() - interval '30 days') as median_verify_s
        from incidents
        """
    )
    agencies = await conn.fetchval("select count(*) from agencies where active")
    return {**dict(row), "agencies": agencies}
