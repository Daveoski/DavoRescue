"""Exercises the real Anthropic SDK against a local stand-in for the Messages API.

Verifies the request DavoRescue sends (model, fallbacks, structured output,
images) and that a well-formed reply becomes a verdict, without a real key.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.core import ai, config
from app.domains.verification import service
from app.domains.verification.schemas import EvidencePhoto, VerificationInput

VERDICT = {
    "verdict": "true",
    "confidence": 0.91,
    "category": "crime",
    "subtype": "kidnapping",
    "severity": 5,
    "panic_score": 88,
    "needs": ["police", "ambulance"],
    "evidence_match": "photo_supports",
    "summary": "Armed men abducted a passenger at Ugwu Onyeama.",
    "dispatch_sms": "KIDNAPPING Ugwu Onyeama, Enugu-Onitsha Expy: 4 armed men, grey Sienna towards 9th Mile.",
    "public_alert": "Kidnapping reported near Ugwu Onyeama. Avoid the expressway towards 9th Mile.",
    "reporter_advice": "Stay out of sight and keep your phone on.",
    "reasons": ["Consistent description", "Live photo at the reported spot"],
    "red_flags": [],
}


class _Handler(BaseHTTPRequestHandler):
    captured: dict = {}

    def do_POST(self):  # noqa: N802 â€” http.server API
        length = int(self.headers["content-length"])
        _Handler.captured = {
            "path": self.path,
            "headers": {k.lower(): v for k, v in self.headers.items()},
            "body": json.loads(self.rfile.read(length)),
        }
        reply = {
            "id": "msg_test",
            "type": "message",
            "role": "assistant",
            "model": "claude-opus-5-5",
            "content": [{"type": "text", "text": json.dumps(VERDICT)}],
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {"input_tokens": 1200, "output_tokens": 180},
        }
        payload = json.dumps(reply).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):  # keep test output quiet
        pass


@pytest.fixture
def fake_api(monkeypatch):
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", f"http://127.0.0.1:{server.server_port}")
    config.get_settings.cache_clear()
    ai._clients.clear()
    yield _Handler
    server.shutdown()
    config.get_settings.cache_clear()
    ai._clients.clear()


async def test_verify_sends_expected_request_and_parses_verdict(fake_api):
    inp = VerificationInput(
        category="crime", subtype="kidnapping",
        description="Dem don carry one man enter grey Sienna for Ugwu Onyeama, dem dey go 9th Mile",
        lat=6.4375, lng=7.4326, accuracy_m=9, location_summary="On Enugu-Onitsha Expressway",
        reported_at_local="Monday 02 November 2026, 21:14 WAT", is_anonymous=True, reporter_history=0,
        injured_count=None,
        photos=[EvidencePhoto(mime="image/jpeg", data_b64="/9j/4AAQ", live_capture=True,
                              seconds_before_report=40, metres_from_report=12)],
        nearby=[],
    )

    result = await service.verify(inp)

    sent = fake_api.captured
    body = sent["body"]
    assert sent["path"].startswith("/v1/messages")
    assert "server-side-fallback-2026-07-01" in sent["headers"].get("anthropic-beta", "")
    assert body["model"] == "claude-opus-5-5"
    assert body["fallbacks"] == "default"
    assert body["output_config"]["effort"] == "low"
    assert body["output_config"]["format"]["type"] == "json_schema"
    content = body["messages"][0]["content"]
    assert content[0]["type"] == "image" and content[0]["source"]["media_type"] == "image/jpeg"
    assert "<report>" in content[-1]["text"]

    assert result.source == "ai"
    assert result.verdict == "true"
    assert result.severity == 5
    assert result.needs == ["police", "ambulance"]
