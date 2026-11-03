"""Build the Road Watch corridor file from OpenStreetMap routing.

    python -m scripts.build_corridors

Geocodes the towns along each major Enugu road, routes between them with OSRM
so the line follows the real road, splits it into ~4 km stretches, labels
each stretch with its locality, and drops stretches outside Enugu State.
Respects Nominatim's one-request-per-second policy.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import httpx

from app.core.geo import haversine_m

OUT = Path(__file__).resolve().parents[1] / "app" / "domains" / "roadwatch" / "corridors.json"
UA = {"User-Agent": "DavoRescue/1.0 road-watch builder (+https://davorescue.vercel.app)"}
SEGMENT_M = 4000
MIN_POINT_SPACING_M = 60

# Waypoints are place names Nominatim resolves, or (lat, lng) where it doesn't.
# Routes run to large towns beyond the border; the state check trims them.
ENUGU_CENTRE = (6.4405, 7.4994)  # Ogui Road
CORRIDORS = [
    {"id": "enugu-onitsha", "name": "Enugu–Onitsha Expressway", "ref": "A232",
     "via": [ENUGU_CENTRE, "9th Mile, Enugu", "Awka, Anambra"]},
    {"id": "enugu-port-harcourt", "name": "Enugu–Port Harcourt Expressway", "ref": "A3",
     "via": ["Amechi, Enugu", "Umuahia, Abia"]},
    {"id": "enugu-abakaliki", "name": "Enugu–Abakaliki Road", "ref": "A343",
     "via": ["Emene, Enugu", "Abakaliki, Ebonyi"]},
    {"id": "ninth-mile-nsukka", "name": "Ninth Mile–Nsukka Road", "ref": None,
     "via": ["9th Mile, Enugu", "Okpatu, Enugu", "Nsukka, Enugu"]},
    {"id": "enugu-opi-nsukka", "name": "Enugu–Opi–Nsukka Road", "ref": None,
     "via": ["Abakpa Nike, Enugu", "Opi, Enugu", "Nsukka, Enugu"]},
    {"id": "nsukka-obollo", "name": "Nsukka–Obollo-Afor Road", "ref": "A3",
     "via": ["Nsukka, Enugu", "Obollo-Afor, Enugu", "Ugbokolo, Benue"]},
    {"id": "enugu-agbani", "name": "Enugu–Agbani Road", "ref": None,
     "via": ["Gariki, Enugu", "Agbani, Enugu"]},
    {"id": "nsukka-adani", "name": "Nsukka–Adani Road", "ref": None,
     "via": ["Nsukka, Enugu", "Adani, Enugu"]},
]


def get(client: httpx.Client, url: str, params: dict) -> httpx.Response:
    """GET with a few retries; public OSM services and flaky networks both drop requests."""
    for attempt in range(5):
        try:
            res = client.get(url, params=params)
            res.raise_for_status()
            return res
        except (httpx.TransportError, httpx.HTTPStatusError):
            if attempt == 4:
                raise
            time.sleep(2 * (attempt + 1))
    raise AssertionError("unreachable")


def geocode(client: httpx.Client, query: str | tuple[float, float]) -> tuple[float, float]:
    if isinstance(query, tuple):
        return query
    time.sleep(1.1)
    res = get(
        client,
        "https://nominatim.openstreetmap.org/search",
        {"q": f"{query}, Nigeria", "format": "jsonv2", "limit": 1, "countrycodes": "ng"},
    )
    hits = res.json()
    if not hits:
        raise SystemExit(f"Could not geocode {query!r}")
    return float(hits[0]["lat"]), float(hits[0]["lon"])


def route(client: httpx.Client, points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    coords = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in points)
    res = get(
        client,
        f"https://router.project-osrm.org/route/v1/driving/{coords}",
        {"overview": "full", "geometries": "geojson"},
    )
    return [(lat, lng) for lng, lat in res.json()["routes"][0]["geometry"]["coordinates"]]


def thin(line: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out = [line[0]]
    for p in line[1:-1]:
        if haversine_m(*out[-1], *p) >= MIN_POINT_SPACING_M:
            out.append(p)
    out.append(line[-1])
    return out


def split(line: list[tuple[float, float]]) -> list[list[tuple[float, float]]]:
    pieces, current, length = [], [line[0]], 0.0
    for a, b in zip(line, line[1:]):
        current.append(b)
        length += haversine_m(*a, *b)
        if length >= SEGMENT_M:
            pieces.append(current)
            current, length = [b], 0.0
    if len(current) > 1:
        # Fold a short tail into the previous stretch rather than leaving a stub.
        if pieces and length < SEGMENT_M / 3:
            pieces[-1].extend(current[1:])
        else:
            pieces.append(current)
    return pieces


def locality(client: httpx.Client, lat: float, lng: float) -> tuple[str | None, str | None, str | None]:
    time.sleep(1.1)
    res = get(
        client,
        "https://nominatim.openstreetmap.org/reverse",
        {"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 14, "addressdetails": 1},
    )
    a = res.json().get("address", {})
    place = a.get("village") or a.get("town") or a.get("suburb") or a.get("hamlet") or a.get("city") or a.get("county")
    return place, a.get("county"), a.get("state")


def length_m(line: list[tuple[float, float]]) -> float:
    return sum(haversine_m(*a, *b) for a, b in zip(line, line[1:]))


def dedupe(corridors: list[dict], tolerance_m: float = 80) -> list[dict]:
    """Drop stretches already covered by an earlier corridor (e.g. both Nsukka routes share Opi–Nsukka)."""
    seen: list[list[float]] = []
    for c in corridors:
        kept = []
        for s in c["segments"]:
            mid = s["path"][len(s["path"]) // 2]
            if any(haversine_m(*mid, *p) <= tolerance_m for p in seen):
                continue
            kept.append(s)
        seen.extend(p for s in kept for p in s["path"])
        for i, s in enumerate(kept, 1):
            s["seq"] = i
        c["segments"] = kept
    return [c for c in corridors if c["segments"]]


def main() -> None:
    corridors = []
    with httpx.Client(headers=UA, timeout=60) as client:
        for c in CORRIDORS:
            stops = [geocode(client, q) for q in c["via"]]
            line = thin(route(client, stops))
            segments = []
            for piece in split(line):
                mid = piece[len(piece) // 2]
                place, lga, state = locality(client, *mid)
                if not state or "Enugu" not in state:
                    continue
                segments.append({
                    "seq": len(segments) + 1,
                    "label": f"near {place}" if place else "rural stretch",
                    "lga": lga,
                    "length_m": round(length_m(piece)),
                    "path": [[round(lat, 5), round(lng, 5)] for lat, lng in piece],
                })
            total = sum(s["length_m"] for s in segments) / 1000
            print(f"{c['name']}: {len(segments)} stretches, {total:.1f} km in Enugu State")
            corridors.append({"id": c["id"], "name": c["name"], "ref": c["ref"], "segments": segments})

    corridors = dedupe(corridors)
    OUT.write_text(json.dumps({"corridors": corridors}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
