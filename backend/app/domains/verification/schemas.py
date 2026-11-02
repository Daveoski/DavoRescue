from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

Category = Literal["crime", "fire", "medical", "road", "disaster"]
Need = Literal["police", "fire", "ambulance", "road_safety", "disaster"]
EvidenceMatch = Literal["photo_supports", "photo_contradicts", "photo_unclear", "no_photo"]

CATEGORIES: tuple[str, ...] = ("crime", "fire", "medical", "road", "disaster")
NEEDS: tuple[str, ...] = ("police", "fire", "ambulance", "road_safety", "disaster")


@dataclass
class EvidencePhoto:
    mime: str
    data_b64: str
    live_capture: bool
    seconds_before_report: float | None
    metres_from_report: float | None
    previously_submitted: bool = False


@dataclass
class VerificationInput:
    category: str
    subtype: str
    description: str
    lat: float
    lng: float
    accuracy_m: float | None
    location_summary: str
    reported_at_local: str
    is_anonymous: bool
    reporter_history: int
    injured_count: int | None
    photos: list[EvidencePhoto]
    nearby: list[dict]


@dataclass
class VerificationResult:
    verdict: Literal["true", "false"]
    source: Literal["ai", "rules"]
    confidence: float
    category: str
    subtype: str
    severity: int
    panic_score: int
    needs: list[str]
    evidence_match: str
    summary: str
    dispatch_sms: str
    public_alert: str
    reporter_advice: str
    reasons: list[str] = field(default_factory=list)
    red_flags: list[str] = field(default_factory=list)


# JSON schema for Claude's structured output. Numeric ranges are enforced in
# code after parsing, so the schema only carries types and enums.
RESULT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["true", "false"]},
        "confidence": {"type": "number"},
        "category": {"type": "string", "enum": list(CATEGORIES)},
        "subtype": {"type": "string"},
        "severity": {"type": "integer"},
        "panic_score": {"type": "integer"},
        "needs": {"type": "array", "items": {"type": "string", "enum": list(NEEDS)}},
        "evidence_match": {
            "type": "string",
            "enum": ["photo_supports", "photo_contradicts", "photo_unclear", "no_photo"],
        },
        "summary": {"type": "string"},
        "dispatch_sms": {"type": "string"},
        "public_alert": {"type": "string"},
        "reporter_advice": {"type": "string"},
        "reasons": {"type": "array", "items": {"type": "string"}},
        "red_flags": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "verdict", "confidence", "category", "subtype", "severity", "panic_score", "needs",
        "evidence_match", "summary", "dispatch_sms", "public_alert", "reporter_advice",
        "reasons", "red_flags",
    ],
    "additionalProperties": False,
}
