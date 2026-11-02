"""Road context for a GPS fix.

Responders need to know two things about a location: is the incident on a
road a vehicle can use, and if not, where is the nearest point a vehicle can
reach. OSRM's `nearest` service snaps to the drivable network; Nominatim tells
us what the point itself sits on (a footpath, a farm track, a named street).
"""

from __future__ import annotations

import asyncio
from dataclasses import asdict, dataclass
from typing import Literal

import httpx

from app.core import http
from app.core.config import get_settings
from app.core.geo import guess_state, haversine_m, normalise_state

Navigability = Literal["navigable", "unnavigable", "off_network", "unknown"]

MOTOR_ROADS = {
    "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential",
    "service", "living_street", "road", "motorway_link", "trunk_link", "primary_link",
    "secondary_link", "tertiary_link",
}
NON_MOTOR_WAYS = {"track", "path", "footway", "bridleway", "steps", "pedestrian", "cycleway", "corridor"}

# Beyond this distance the snapped point is an access point, not "the road you are on".
ON_ROAD_THRESHOLD_M = 35
OFF_NETWORK_THRESHOLD_M = 120


@dataclass
class AccessPoint:
    lat: float
    lng: float
    distance_m: float
    road_name: str | None


@dataclass
class RoadContext:
    navigability: Navigability
    road_name: str | None
    road_class: str | None
    access: AccessPoint | None
    address: str | None
    lga: str | None
    state: str
    summary: str

    def to_dict(self) -> dict:
        return asdict(self)


async def _osrm_nearest(client: httpx.AsyncClient, lat: float, lng: float) -> AccessPoint | None:
    url = f"{get_settings().osrm_url}/nearest/v1/driving/{lng:.6f},{lat:.6f}"
    try:
        res = await client.get(url, params={"number": 1})
        res.raise_for_status()
        waypoint = res.json()["waypoints"][0]
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        return None
    snap_lng, snap_lat = waypoint["location"]
    return AccessPoint(
        lat=snap_lat,
        lng=snap_lng,
        distance_m=round(haversine_m(lat, lng, snap_lat, snap_lng), 1),
        road_name=waypoint.get("name") or None,
    )


async def _reverse(client: httpx.AsyncClient, lat: float, lng: float) -> dict | None:
    try:
        res = await client.get(
            f"{get_settings().nominatim_url}/reverse",
            params={"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 17, "addressdetails": 1},
        )
        res.raise_for_status()
        data = res.json()
    except (httpx.HTTPError, ValueError):
        return None
    return None if "error" in data else data


def classify(lat: float, lng: float, access: AccessPoint | None, place: dict | None) -> RoadContext:
    address = (place or {}).get("address", {})
    way_type = (place or {}).get("type") if (place or {}).get("category") == "highway" else None
    way_name = address.get("road") or ((place or {}).get("name") if way_type else None)
    state = normalise_state(address.get("state")) or guess_state(lat, lng)
    lga = address.get("county") or address.get("city_district") or address.get("city") or address.get("town")
    display = (place or {}).get("display_name")

    if way_type in NON_MOTOR_WAYS:
        navigability: Navigability = "unnavigable"
    elif access is None:
        navigability = "unknown"
    elif access.distance_m <= ON_ROAD_THRESHOLD_M:
        navigability = "navigable"
    elif access.distance_m >= OFF_NETWORK_THRESHOLD_M:
        navigability = "off_network"
    else:
        navigability = "navigable" if way_type in MOTOR_ROADS else "unnavigable"

    road_name = way_name or (access.road_name if access and navigability == "navigable" else None)
    road_class = way_type

    if navigability == "navigable":
        summary = f"On {road_name or 'an unnamed motorable road'}"
    elif navigability == "unnavigable":
        kind = (way_type or "unpaved way").replace("_", " ")
        summary = f"On a {kind}{f' ({way_name})' if way_name else ''} — not motorable"
    elif navigability == "off_network":
        summary = "No mapped road at this spot"
    else:
        summary = "Road data unavailable — exact GPS position used"

    if access and navigability != "navigable":
        target = access.road_name or "the nearest motorable road"
        summary += f". Vehicle access: {target}, {int(access.distance_m)} m away"

    return RoadContext(
        navigability=navigability,
        road_name=road_name,
        road_class=road_class,
        access=access,
        address=display,
        lga=lga,
        state=state,
        summary=summary,
    )


async def road_context(lat: float, lng: float) -> RoadContext:
    async with http.client(timeout=5.0) as client:
        access, place = await asyncio.gather(_osrm_nearest(client, lat, lng), _reverse(client, lat, lng))
    return classify(lat, lng, access, place)
