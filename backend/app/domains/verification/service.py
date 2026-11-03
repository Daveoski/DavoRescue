from __future__ import annotations

import json
import logging

import anthropic

from app.core.ai import FALLBACK_BETA, get_client
from app.core.config import get_settings
from app.domains.verification import rules
from app.domains.verification.prompt import SYSTEM_PROMPT, build_user_text
from app.domains.verification.schemas import (
    CATEGORIES,
    NEEDS,
    RESULT_SCHEMA,
    VerificationInput,
    VerificationResult,
)

log = logging.getLogger("davorescue.verification")


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _coerce(raw: dict, inp: VerificationInput) -> VerificationResult:
    category = raw.get("category") if raw.get("category") in CATEGORIES else inp.category
    needs = [n for n in raw.get("needs", []) if n in NEEDS] or rules.triage(inp).needs
    return VerificationResult(
        verdict="true" if raw.get("verdict") == "true" else "false",
        source="ai",
        confidence=round(_clamp(float(raw.get("confidence", 0.5)), 0, 1), 2),
        category=category,
        subtype=(raw.get("subtype") or inp.subtype)[:40].lower(),
        severity=int(_clamp(int(raw.get("severity", 3)), 1, 5)),
        panic_score=int(_clamp(int(raw.get("panic_score", 50)), 0, 100)),
        needs=needs,
        evidence_match=raw.get("evidence_match", "no_photo"),
        summary=raw.get("summary", "")[:300],
        dispatch_sms=raw.get("dispatch_sms", "")[:300],
        public_alert=raw.get("public_alert", "")[:160],
        reporter_advice=raw.get("reporter_advice", "")[:300],
        reasons=[str(r)[:160] for r in raw.get("reasons", [])][:4],
        red_flags=[str(r)[:160] for r in raw.get("red_flags", [])][:4],
    )


async def verify(inp: VerificationInput) -> VerificationResult:
    settings = get_settings()
    if not settings.ai_enabled:
        return rules.triage(inp)

    content: list[dict] = [
        {"type": "image", "source": {"type": "base64", "media_type": p.mime, "data": p.data_b64}}
        for p in inp.photos
    ]
    content.append({"type": "text", "text": build_user_text(inp)})

    try:
        # Emergencies can't wait on long retries: one retry, then fall back to rules.
        response = await get_client(timeout=25.0).beta.messages.create(
            model=settings.ai_model,
            max_tokens=4000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
            output_config={
                "effort": "low",
                "format": {"type": "json_schema", "schema": RESULT_SCHEMA},
            },
        )
    except anthropic.APIConnectionError:
        log.warning("AI desk unreachable; using rules")
        return rules.triage(inp)
    except anthropic.RateLimitError:
        log.warning("AI desk rate limited; using rules")
        return rules.triage(inp)
    except anthropic.APIStatusError as exc:
        log.error("AI desk error %s: %s", exc.status_code, exc.message)
        return rules.triage(inp)

    if response.stop_reason == "refusal":
        log.warning("AI desk declined report; using rules")
        return rules.triage(inp)

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        return rules.triage(inp)
    try:
        return _coerce(json.loads(text), inp)
    except (ValueError, TypeError) as exc:
        log.error("Unparseable AI verdict: %s", exc)
        return rules.triage(inp)
