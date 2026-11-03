from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

import asyncpg

from app.core.config import get_settings
from app.core.geo import bbox_around
from app.domains.roadwatch import scoring
from app.domains.roadwatch.assess import assess
from app.domains.roadwatch.imagery import ImageryUnavailable, stretch_imagery

log = logging.getLogger("davorescue.roadwatch")

# Each stretch downloads ~32 tiles and makes one AI call; keep the fan-out polite.
CONCURRENCY = 3
DEFAULT_BATCH = 10  # ~2–3 minutes with AI review; the daily cron covers every major road in about a week

_SEGMENT_SELECT = "s.id, s.corridor_id, s.corridor_name, s.ref, s.seq, s.label, s.lga, s.length_m, s.path"


async def _due_segments(conn: asyncpg.Connection, limit: int) -> list[dict]:
    """Never-reviewed stretches first; then, once AI review is on, stretches that only have the
    pixel measurement; then whichever was reviewed longest ago."""
    rows = await conn.fetch(
        f"""
        select {_SEGMENT_SELECT}
        from road_segments s
        left join lateral (
          select max(scanned_at) as last, bool_or(method = 'ai') as ai_reviewed
          from road_assessments a where a.segment_id = s.id
        ) l on true
        order by (l.last is null) desc, ($2::boolean and not coalesce(l.ai_reviewed, false)) desc,
                 l.last asc nulls first, s.corridor_id, s.seq
        limit $1
        """,
        limit, get_settings().ai_enabled,
    )
    return [dict(r) for r in rows]


async def _review(segment: dict, gate: asyncio.Semaphore) -> tuple[dict, object | None, str | None]:
    async with gate:
        try:
            imagery = await stretch_imagery(segment["path"])
            return segment, (imagery, await assess(segment, imagery)), None
        except ImageryUnavailable as exc:
            return segment, None, str(exc)
        except Exception as exc:  # noqa: BLE001 — one bad stretch must not stop the batch
            log.exception("review failed for %s", segment["id"])
            return segment, None, exc.__class__.__name__


async def scan(conn: asyncpg.Connection, limit: int = DEFAULT_BATCH) -> dict:
    segments = await _due_segments(conn, limit)
    gate = asyncio.Semaphore(CONCURRENCY)
    results = await asyncio.gather(*(_review(s, gate) for s in segments))

    done, failed = [], []
    for segment, outcome, error in results:
        if outcome is None:
            failed.append({"segment": segment["id"], "error": error})
            continue
        imagery, a = outcome
        await conn.execute(
            """
            insert into road_assessments (segment_id, method, exposure_risk, physical_risk, vegetation_pct, surface,
                                          settlement, hazards, summary, advice, confidence, model, imagery_date,
                                          imagery_res_m)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            """,
            segment["id"], a.method, a.exposure_risk, a.physical_risk, imagery.vegetation_pct, a.surface,
            a.settlement, a.hazards, a.summary, a.advice, a.confidence, a.model, imagery.captured_on,
            imagery.resolution_m,
        )
        done.append({"segment": segment["id"], "method": a.method})
    return {"reviewed": done, "failed": failed, "ai": get_settings().ai_enabled}


async def _recent_incidents(conn: asyncpg.Connection) -> list[dict]:
    # Generous box around Enugu State; exact distances are checked per stretch.
    min_lat, max_lat, min_lng, max_lng = bbox_around(6.6, 7.45, 110_000)
    rows = await conn.fetch(
        """
        select ref, category, subtype, severity, lat, lng, created_at from incidents
        where verdict = 'true' and created_at > now() - make_interval(days => $1)
          and lat between $2 and $3 and lng between $4 and $5
        """,
        scoring.WINDOW_DAYS, min_lat, max_lat, min_lng, max_lng,
    )
    return [dict(r) for r in rows]


async def road_watch(conn: asyncpg.Connection) -> dict:
    """Every stretch with its latest satellite review and live incident-based risk."""
    rows = await conn.fetch(
        f"""
        select {_SEGMENT_SELECT},
               s.min_lat, s.max_lat, s.min_lng, s.max_lng,
               a.scanned_at, a.method, a.exposure_risk, a.physical_risk, a.vegetation_pct, a.surface, a.settlement,
               a.hazards, a.summary, a.advice, a.confidence, a.imagery_date, a.imagery_res_m
        from road_segments s
        left join lateral (
          select * from road_assessments x where x.segment_id = s.id order by x.scanned_at desc limit 1
        ) a on true
        order by s.corridor_id, s.seq
        """
    )
    incidents = await _recent_incidents(conn)
    now = datetime.now(UTC)
    pad = 0.004  # ~400 m: cheap box test before exact distance

    corridors: dict[str, dict] = {}
    for r in rows:
        nearby = [
            i for i in incidents
            if r["min_lat"] - pad <= i["lat"] <= r["max_lat"] + pad and r["min_lng"] - pad <= i["lng"] <= r["max_lng"] + pad
            and scoring.distance_to_path_m(i["lat"], i["lng"], r["path"]) <= scoring.INCIDENT_BUFFER_M
        ]
        incident = scoring.incident_risk(nearby, now)
        environment = (
            scoring.environment_risk(r["exposure_risk"], r["physical_risk"]) if r["scanned_at"] is not None else None
        )
        risk, level = scoring.overall(incident, environment)
        segment = {
            "id": r["id"],
            "seq": r["seq"],
            "label": r["label"],
            "lga": r["lga"],
            "length_m": r["length_m"],
            "path": r["path"],
            "risk": risk,
            "level": level,
            "incident_risk": incident,
            "incidents_90d": len(nearby),
            "recent_incidents": [
                {"ref": i["ref"], "subtype": i["subtype"], "created_at": i["created_at"]}
                for i in sorted(nearby, key=lambda i: i["created_at"], reverse=True)[:3]
            ],
            "assessment": None if r["scanned_at"] is None else {
                "scanned_at": r["scanned_at"],
                "method": r["method"],
                "exposure_risk": r["exposure_risk"],
                "physical_risk": r["physical_risk"],
                "vegetation_pct": r["vegetation_pct"],
                "surface": r["surface"],
                "settlement": r["settlement"],
                "hazards": r["hazards"],
                "summary": r["summary"],
                "advice": r["advice"],
                "confidence": r["confidence"],
                "imagery_date": r["imagery_date"],
                "imagery_res_m": r["imagery_res_m"],
            },
        }
        c = corridors.setdefault(
            r["corridor_id"],
            {"id": r["corridor_id"], "name": r["corridor_name"], "ref": r["ref"], "segments": []},
        )
        c["segments"].append(segment)

    out = []
    for c in corridors.values():
        worst = max(c["segments"], key=lambda s: s["risk"])
        c.update(
            risk=worst["risk"],
            level=worst["level"],
            length_km=round(sum(s["length_m"] for s in c["segments"]) / 1000, 1),
            reviewed=sum(s["assessment"] is not None for s in c["segments"]),
        )
        out.append(c)
    out.sort(key=lambda c: c["risk"], reverse=True)

    scanned = [r["scanned_at"] for r in rows if r["scanned_at"] is not None]
    return {
        "generated_at": now,
        "last_scan": max(scanned) if scanned else None,
        "stretches": len(rows),
        "reviewed": len(scanned),
        "ai_review": get_settings().ai_enabled,
        "window_days": scoring.WINDOW_DAYS,
        "corridors": out,
    }
