"""How a stretch's rating is worked out.

Verified incident reports are the evidence of what is actually happening on a
road, so they dominate. Satellite findings (isolation, cover, physical hazards)
describe how exposed a stretch is; on their own they can raise it to
"caution" but never to "avoid".
"""

from __future__ import annotations

import math
from datetime import datetime

CATEGORY_WEIGHT = {"crime": 1.0, "disaster": 0.8, "road": 0.5, "fire": 0.4, "medical": 0.2}
INCIDENT_BUFFER_M = 300
WINDOW_DAYS = 90
HALF_LIFE_DAYS = 21

SAFE_BELOW = 35
AVOID_FROM = 65


def _local_xy(lat: float, lng: float, lat0: float) -> tuple[float, float]:
    return lng * 111_320 * math.cos(math.radians(lat0)), lat * 110_540


def distance_to_path_m(lat: float, lng: float, path: list[list[float]]) -> float:
    """Shortest distance from a point to a [[lat, lng], ...] polyline, in metres."""
    px, py = _local_xy(lat, lng, lat)
    best = math.inf
    for (alat, alng), (blat, blng) in zip(path, path[1:]):
        ax, ay = _local_xy(alat, alng, lat)
        bx, by = _local_xy(blat, blng, lat)
        dx, dy = bx - ax, by - ay
        span = dx * dx + dy * dy
        t = 0.0 if span == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / span))
        best = min(best, math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    return best


def incident_risk(incidents: list[dict], now: datetime) -> int:
    """0–100 from verified incidents near the stretch; recent and violent ones count most."""
    total = 0.0
    for i in incidents:
        days = max(0.0, (now - i["created_at"]).total_seconds() / 86_400)
        recency = 0.5 ** (days / HALF_LIFE_DAYS)
        total += (i["severity"] or 3) * recency * CATEGORY_WEIGHT.get(i["category"], 0.5)
    # One severe kidnapping today ≈ 60; two ≈ 100.
    return min(100, round(12 * total))


def environment_risk(exposure: int, physical: int) -> int:
    return round(0.6 * exposure + 0.4 * physical)


def overall(incident: int, environment: int | None) -> tuple[int, str]:
    env_part = round(0.75 * environment) if environment is not None else 0
    risk = max(incident, min(env_part, AVOID_FROM - 1))
    if incident > 0 and environment is not None and environment >= 50:
        risk = min(100, risk + 10)  # trouble reported on an exposed stretch
    level = "safe" if risk < SAFE_BELOW else "avoid" if risk >= AVOID_FROM else "caution"
    return risk, level
