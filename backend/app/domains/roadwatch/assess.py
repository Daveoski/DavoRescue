"""AI review of a road stretch's satellite views, with a measured-only fallback."""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass, field

import anthropic

from app.core.ai import FALLBACK_BETA, get_client
from app.core.config import get_settings
from app.domains.roadwatch.imagery import StretchImagery

log = logging.getLogger("davorescue.roadwatch")

SYSTEM_PROMPT = """\
You review satellite images of major roads in Enugu State, Nigeria, for an emergency-response service that rates \
how safe each stretch is to travel.

Each image is a still photograph about 1.8 km across, taken on the date given. The road being assessed is outlined \
by two magenta edges; the road surface between them is left unmarked so you can inspect it. The images show the road \
and its surroundings — never live events. Do not claim to see crime, \
criminals, kidnappers, checkpoints or roadblocks, and do not guess anyone's intentions. Judge only what is visible.

Assess two things:

1. Physical condition (physical_risk, 0–100): erosion gullies or washouts cutting into the road or its shoulders, \
flooding or standing water, broken, potholed or unpaved surface, narrowing to a single lane, damaged or single-lane \
bridges, debris or obstructions, burn scars. 0 = smooth paved road with no visible hazards; 50 = hazards that force \
vehicles to slow or swerve; 90+ = road cut, washed out or impassable.

2. Exposure (exposure_risk, 0–100): how isolated the stretch is — thick bush or forest close to both edges, long \
distances with no buildings, no markets or fuel stations, valleys and sharp bends that slow vehicles. Isolation and \
cover are known risk factors for highway robbery and kidnapping in South-East Nigeria, but they are not evidence of \
crime. 0 = built-up town; 50 = rural with scattered settlements; 90+ = long isolated stretch with dense cover on \
both sides.

List each visible hazard with severity 1 (minor) to 3 (serious) and a short note saying where it is. Write \
summary as plain facts a driver can use (max 220 characters) and advice as one practical instruction (max 140 \
characters). Don't mention scores. Lower confidence when the image is cloudy, blurred or the road is hard to see.
"""

RESULT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "surface": {"type": "string", "enum": ["paved_good", "paved_worn", "unpaved", "mixed", "unclear"]},
        "settlement": {"type": "string", "enum": ["urban", "peri_urban", "rural", "isolated"]},
        "vegetation": {"type": "string", "enum": ["sparse", "moderate", "dense"]},
        "hazards": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["erosion", "flooding", "surface_damage", "narrowing", "bridge", "obstruction",
                                 "burn_scar", "other"],
                    },
                    "severity": {"type": "integer"},
                    "note": {"type": "string"},
                },
                "required": ["type", "severity", "note"],
                "additionalProperties": False,
            },
        },
        "physical_risk": {"type": "integer"},
        "exposure_risk": {"type": "integer"},
        "summary": {"type": "string"},
        "advice": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": ["surface", "settlement", "vegetation", "hazards", "physical_risk", "exposure_risk", "summary",
                 "advice", "confidence"],
    "additionalProperties": False,
}


@dataclass
class StretchAssessment:
    method: str  # "ai" or "imagery"
    exposure_risk: int
    physical_risk: int
    summary: str
    advice: str | None = None
    surface: str | None = None
    settlement: str | None = None
    hazards: list[dict] = field(default_factory=list)
    confidence: float | None = None
    model: str | None = None


def _clamp(value, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, int(value)))


def measured_only(imagery: StretchImagery) -> StretchAssessment:
    """Used when the AI reviewer is unavailable: only what the pixels measure."""
    v = imagery.vegetation_pct
    cover = "dense" if v >= 65 else "moderate" if v >= 40 else "light"
    return StretchAssessment(
        method="imagery",
        # Cover alone is a weak signal, so it never pushes a stretch past "caution" on its own.
        exposure_risk=_clamp(v * 0.8),
        physical_risk=0,
        summary=f"Vegetation covers about {v}% of the ground within 120 m of the road ({cover} cover). "
        "Road surface and erosion haven't been reviewed yet.",
    )


def _context(road: dict, imagery: StretchImagery) -> str:
    when = imagery.captured_on.strftime("%d %B %Y") if imagery.captured_on else "unknown date"
    resolution = f", {imagery.resolution_m:.2f} m resolution" if imagery.resolution_m else ""
    return (
        f"Road: {road['corridor_name']}{f' ({road['ref']})' if road.get('ref') else ''}, stretch {road['seq']} "
        f"{road['label']}{f', {road['lga']} LGA' if road.get('lga') else ''}, {road['length_m'] / 1000:.1f} km long.\n"
        f"Imagery captured {when}{resolution}. Image 1 shows the first half of the stretch, image 2 the second half.\n"
        f"Measured vegetation cover within 120 m of the road: {imagery.vegetation_pct}%."
    )


async def assess(road: dict, imagery: StretchImagery) -> StretchAssessment:
    settings = get_settings()
    if not settings.ai_enabled:
        return measured_only(imagery)

    content: list[dict] = [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(v).decode()}}
        for v in imagery.views
    ]
    content.append({"type": "text", "text": _context(road, imagery)})
    try:
        response = await get_client(timeout=90.0).beta.messages.create(
            model=settings.ai_model,
            max_tokens=4000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": RESULT_SCHEMA}},
        )
    except anthropic.APIError as exc:
        log.warning("Road review failed for %s: %s", road["id"], exc)
        return measured_only(imagery)

    text = next((b.text for b in response.content if b.type == "text"), None)
    if response.stop_reason == "refusal" or not text:
        return measured_only(imagery)
    try:
        raw = json.loads(text)
    except ValueError:
        return measured_only(imagery)

    return StretchAssessment(
        method="ai",
        exposure_risk=_clamp(raw["exposure_risk"]),
        physical_risk=_clamp(raw["physical_risk"]),
        summary=str(raw["summary"])[:260],
        advice=str(raw["advice"])[:180] or None,
        surface=raw["surface"],
        settlement=raw["settlement"],
        hazards=[
            {"type": h["type"], "severity": _clamp(h["severity"], 1, 3), "note": str(h["note"])[:160]}
            for h in raw.get("hazards", [])
        ][:6],
        confidence=round(max(0.0, min(1.0, float(raw["confidence"]))), 2),
        model=response.model,
    )
