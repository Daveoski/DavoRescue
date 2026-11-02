from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_000

# Coarse bounding boxes for the South East. Only used when reverse geocoding
# is unavailable; Enugu is checked first because it is the primary service area.
Box = tuple[float, float, float, float]  # (min_lat, max_lat, min_lng, max_lng)

STATE_BOUNDS: dict[str, tuple[Box, ...]] = {
    # Enugu's western border bends east south of Nsukka, so it gets two boxes
    # to keep Awka and Onitsha in Anambra.
    "enugu": ((6.55, 7.10, 6.90, 7.85), (5.90, 6.55, 7.12, 7.85)),
    "ebonyi": ((5.70, 6.80, 7.60, 8.45),),
    "anambra": ((5.70, 6.80, 6.60, 7.20),),
    "abia": ((4.75, 6.00, 7.00, 7.95),),
    "imo": ((5.10, 5.95, 6.60, 7.45),),
}

SOUTH_EAST = tuple(STATE_BOUNDS)


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def bbox_around(lat: float, lng: float, radius_m: float) -> tuple[float, float, float, float]:
    dlat = math.degrees(radius_m / EARTH_RADIUS_M)
    dlng = math.degrees(radius_m / (EARTH_RADIUS_M * max(math.cos(math.radians(lat)), 1e-6)))
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng


def guess_state(lat: float, lng: float) -> str:
    for state, boxes in STATE_BOUNDS.items():
        for min_lat, max_lat, min_lng, max_lng in boxes:
            if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
                return state
    return "other"


def normalise_state(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.lower().replace("state", "").strip()
    return key if key in STATE_BOUNDS else "other"


def maps_link(lat: float, lng: float) -> str:
    return f"https://www.google.com/maps/search/?api=1&query={lat:.6f},{lng:.6f}"
