"""Deterministic triage used when the AI desk is unavailable.

It never blocks a plausible report: when in doubt it verifies, because the
service must keep dispatching even if the model API is down.
"""

from __future__ import annotations

import re

from app.domains.verification.schemas import VerificationInput, VerificationResult

_SIGNALS: list[tuple[str, str, str, int, list[str]]] = [
    # (pattern, category, subtype, severity, needs)
    (r"kidnap|abduct|carried (him|her|them) away|bundle[d]? (him|her|them)|kpu?ru", "crime", "kidnapping", 5, ["police"]),
    (r"shoot|gun ?shot|gunfire|firing|gunmen|ak-?47|bullet", "crime", "gunshots", 5, ["police", "ambulance"]),
    (r"blast|explo|bomb|ied\b", "disaster", "explosion", 5, ["fire", "police", "ambulance", "disaster"]),
    (r"rob|armed men|robbers|one chance|snatch|thief|thieves|ole\b", "crime", "armed robbery", 4, ["police"]),
    (r"cult|clash|machete|matchet|stab", "crime", "violent attack", 4, ["police", "ambulance"]),
    (r"fire|burn|flame|smoke|ọkụ|oku", "fire", "fire", 4, ["fire"]),
    (r"crash|accident|collision|somersault|tanker|trailer|hit and run|knock(ed)? down", "road", "road crash", 4,
     ["road_safety", "ambulance"]),
    (r"flood|collapse|landslide|erosion", "disaster", "structural/flood", 4, ["disaster", "fire"]),
    (r"unconscious|collapsed|not breathing|bleeding|heart|seizure|labou?r|pregnan|faint", "medical",
     "medical emergency", 4, ["ambulance"]),
]

_SPAM = re.compile(r"\b(test(ing)?|lol|lmao|hello|hi|asdf|qwerty|joke|prank)\b", re.IGNORECASE)
_URGENT = re.compile(r"!{2,}|\b(help|now|please|abeg|biko|hurry|quick|dying|dead|blood)\b", re.IGNORECASE)


def triage(inp: VerificationInput) -> VerificationResult:
    text = f"{inp.subtype} {inp.description}".lower()
    category, subtype, severity, needs = inp.category, inp.subtype, 3, []
    for pattern, cat, sub, sev, svc in _SIGNALS:
        if re.search(pattern, text):
            category, subtype, severity, needs = cat, sub, sev, svc
            break
    if not needs:
        needs = {"crime": ["police"], "fire": ["fire"], "medical": ["ambulance"],
                 "road": ["road_safety", "ambulance"], "disaster": ["disaster", "fire"]}[category]

    words = re.findall(r"\w+", inp.description)
    spam_only = bool(_SPAM.search(inp.description)) and len(words) < 6 and not inp.photos
    corroborated = len(inp.nearby) > 0
    verdict = "false" if spam_only and not corroborated else "true"

    urgency_hits = len(_URGENT.findall(inp.description))
    panic = min(100, 25 + severity * 10 + urgency_hits * 8 + (10 if corroborated else 0))
    place = inp.location_summary
    reasons = ["Automatic keyword triage (AI desk unavailable)"]
    if corroborated:
        reasons.append(f"{len(inp.nearby)} other report(s) nearby in the last hour")
    if inp.photos:
        reasons.append("Photo evidence attached")

    return VerificationResult(
        verdict=verdict,
        source="rules",
        confidence=0.55 if verdict == "true" else 0.6,
        category=category,
        subtype=subtype,
        severity=severity,
        panic_score=panic,
        needs=needs,
        evidence_match="photo_unclear" if inp.photos else "no_photo",
        summary=f"{subtype.capitalize()} reported — {place}.",
        dispatch_sms=f"{subtype.upper()} reported: {place}. {inp.description[:180]}",
        public_alert=f"{subtype.capitalize()} reported near {place.split('.')[0]}. Avoid the area if you can.",
        reporter_advice="Move to a safe place and keep your phone on. Responders may call you.",
        reasons=reasons,
        red_flags=["Very short message that looks like a test"] if verdict == "false" else [],
    )
