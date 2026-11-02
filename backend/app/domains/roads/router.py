from __future__ import annotations

from fastapi import APIRouter, Query

from app.domains.roads.service import road_context

router = APIRouter(prefix="/api/roads", tags=["roads"])


@router.get("/context")
async def context(lat: float = Query(ge=-90, le=90), lng: float = Query(ge=-180, le=180)) -> dict:
    return (await road_context(lat, lng)).to_dict()
