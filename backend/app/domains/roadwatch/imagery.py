"""Satellite views of a road stretch, built from Esri World Imagery tiles.

Each view is a 3×3 block of zoom-16 tiles (~1.8 km across in Enugu) centred
on a point along the stretch, with the road outlined in magenta so the
reviewer knows which road is being assessed. Vegetation cover is measured from the
pixels themselves, inside a 120 m band either side of the road.
"""

from __future__ import annotations

import asyncio
import io
import math
from dataclasses import dataclass
from datetime import date

import httpx
from PIL import Image, ImageDraw

from app.core import http
from app.core.geo import haversine_m

TILE = 256
ZOOM = 16
GRID = 3
BUFFER_M = 120
ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"


class ImageryUnavailable(Exception):
    pass


@dataclass
class StretchImagery:
    views: list[bytes]  # JPEGs with the road drawn on
    vegetation_pct: int
    captured_on: date | None
    resolution_m: float | None


def world_pixel(lat: float, lng: float, zoom: int = ZOOM) -> tuple[float, float]:
    """Web Mercator pixel coordinates at `zoom`."""
    scale = TILE * 2**zoom
    siny = min(max(math.sin(math.radians(lat)), -0.9999), 0.9999)
    x = (lng + 180) / 360 * scale
    y = (0.5 - math.log((1 + siny) / (1 - siny)) / (4 * math.pi)) * scale
    return x, y


def metres_per_pixel(lat: float, zoom: int = ZOOM) -> float:
    return 156_543.03392 * math.cos(math.radians(lat)) / 2**zoom


def point_along(path: list[list[float]], fraction: float) -> tuple[float, float]:
    """Point `fraction` of the way along a [[lat, lng], ...] polyline."""
    lengths = [haversine_m(*a, *b) for a, b in zip(path, path[1:])]
    goal = sum(lengths) * fraction
    for (a, b), length in zip(zip(path, path[1:]), lengths):
        if goal <= length and length > 0:
            t = goal / length
            return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        goal -= length
    return tuple(path[-1])  # type: ignore[return-value]


def is_vegetation(r: int, g: int, b: int) -> bool:
    """Clearly green, not just olive. Imagery over Enugu has a yellow cast, so brown roofs,
    laterite and dry grass score high on plain excess-green; requiring green to beat red
    and blue keeps them out."""
    total = r + g + b
    return total >= 40 and g > r * 1.05 and g > b * 1.15 and (2 * g - r - b) / total > 0.06


def vegetation_share(image: Image.Image, mask: Image.Image) -> float:
    """Share of the masked area covered by vegetation."""
    small, small_mask = image.resize((256, 256)), mask.resize((256, 256))
    vegetated = counted = 0
    for (r, g, b), m in zip(small.getdata(), small_mask.getdata()):
        if m < 128 or r + g + b < 40:  # outside the band, or deep shadow we can't read
            continue
        counted += 1
        vegetated += is_vegetation(r, g, b)
    return vegetated / counted if counted else 0.0


def outline_road(canvas: Image.Image, line: list[tuple[float, float]]) -> Image.Image:
    """Magenta edges either side of the road, leaving the road surface itself visible."""
    marked = canvas.copy()
    ImageDraw.Draw(marked).line(line, fill=(255, 0, 200), width=20, joint="curve")
    inner = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(inner).line(line, fill=255, width=12, joint="curve")
    marked.paste(canvas, mask=inner)
    return marked


async def _tile(client: httpx.AsyncClient, x: int, y: int) -> Image.Image | None:
    try:
        res = await client.get(f"{ESRI}/tile/{ZOOM}/{y}/{x}")
        res.raise_for_status()
        return Image.open(io.BytesIO(res.content)).convert("RGB")
    except (httpx.HTTPError, OSError):
        return None


async def _view(
    client: httpx.AsyncClient, centre: tuple[float, float], path: list[list[float]]
) -> tuple[bytes, float]:
    size = TILE * GRID
    cx, cy = world_pixel(*centre)
    x0, y0 = cx - size / 2, cy - size / 2
    tx0, ty0 = int(x0 // TILE), int(y0 // TILE)
    coords = [(tx, ty) for ty in range(ty0, ty0 + GRID + 1) for tx in range(tx0, tx0 + GRID + 1)]
    tiles = await asyncio.gather(*(_tile(client, tx, ty) for tx, ty in coords))
    if sum(t is None for t in tiles) > len(tiles) // 2:
        raise ImageryUnavailable("Satellite tiles could not be downloaded")

    canvas = Image.new("RGB", (size, size), (90, 90, 90))
    for (tx, ty), tile in zip(coords, tiles):
        if tile is not None:
            canvas.paste(tile, (round(tx * TILE - x0), round(ty * TILE - y0)))

    line = [(world_pixel(lat, lng)[0] - x0, world_pixel(lat, lng)[1] - y0) for lat, lng in path]
    mask = Image.new("L", (size, size), 0)
    band = max(4, round(2 * BUFFER_M / metres_per_pixel(centre[0])))
    ImageDraw.Draw(mask).line(line, fill=255, width=band, joint="curve")
    share = vegetation_share(canvas, mask)

    out = io.BytesIO()
    outline_road(canvas, line).save(out, format="JPEG", quality=80)
    return out.getvalue(), share


async def _capture_info(client: httpx.AsyncClient, lat: float, lng: float) -> tuple[date | None, float | None]:
    """Esri reports which source image covers a point, with its date and resolution."""
    try:
        res = await client.get(
            f"{ESRI}/identify",
            params={
                "geometry": f"{lng},{lat}", "geometryType": "esriGeometryPoint", "sr": 4326, "layers": "all",
                "tolerance": 2, "mapExtent": f"{lng - 0.01},{lat - 0.01},{lng + 0.01},{lat + 0.01}",
                "imageDisplay": "600,600,96", "returnGeometry": "false", "f": "json",
            },
        )
        res.raise_for_status()
        for result in res.json().get("results", []):
            attrs = result.get("attributes", {})
            raw = str(attrs.get("DATE (YYYYMMDD)") or "")
            if raw.isdigit() and len(raw) == 8:
                resolution = attrs.get("RESOLUTION (M)")
                return date(int(raw[:4]), int(raw[4:6]), int(raw[6:])), float(resolution) if resolution else None
    except (httpx.HTTPError, ValueError):
        pass
    return None, None


async def stretch_imagery(path: list[list[float]]) -> StretchImagery:
    centres = [point_along(path, 0.25), point_along(path, 0.75)]
    async with http.client(timeout=20.0) as client:
        views, (captured_on, resolution) = await asyncio.gather(
            asyncio.gather(*(_view(client, c, path) for c in centres)),
            _capture_info(client, *point_along(path, 0.5)),
        )
    return StretchImagery(
        views=[jpeg for jpeg, _ in views],
        vegetation_pct=round(100 * sum(share for _, share in views) / len(views)),
        captured_on=captured_on,
        resolution_m=resolution,
    )
