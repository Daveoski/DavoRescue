from __future__ import annotations

import json
import threading
from datetime import UTC, date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.core import ai, config
from app.domains.roadwatch import assess as assess_mod
from app.domains.roadwatch import scoring
from app.domains.roadwatch.imagery import StretchImagery, is_vegetation, point_along, world_pixel

NOW = datetime(2026, 11, 3, 12, tzinfo=UTC)
PATH = [[6.4300, 7.4100], [6.4400, 7.4100], [6.4500, 7.4100]]  # ~2.2 km due north


def incident(days_ago: float, category: str = "crime", severity: int = 5) -> dict:
    return {"category": category, "severity": severity, "created_at": NOW - timedelta(days=days_ago)}


def test_distance_to_path():
    assert scoring.distance_to_path_m(6.4400, 7.4100, PATH) < 1
    assert 105 < scoring.distance_to_path_m(6.4400, 7.4110, PATH) < 115  # ~0.001° of longitude east
    assert scoring.distance_to_path_m(6.4600, 7.4100, PATH) > 1000  # beyond the end


def test_incident_risk_weights_recency_and_type():
    assert scoring.incident_risk([], NOW) == 0
    fresh_kidnapping = scoring.incident_risk([incident(0)], NOW)
    assert 55 <= fresh_kidnapping <= 65
    assert scoring.incident_risk([incident(42)], NOW) < fresh_kidnapping / 3  # two half-lives later
    assert scoring.incident_risk([incident(0, "medical")], NOW) < 20
    assert scoring.incident_risk([incident(0), incident(1)], NOW) == 100


def test_satellite_alone_never_reaches_avoid():
    risk, level = scoring.overall(0, environment=100)
    assert level == "caution" and risk < scoring.AVOID_FROM


def test_reports_on_exposed_stretch_mean_avoid():
    _, level = scoring.overall(scoring.incident_risk([incident(2)], NOW), scoring.environment_risk(80, 40))
    assert level == "avoid"


def test_quiet_town_road_is_safe():
    risk, level = scoring.overall(0, scoring.environment_risk(10, 5))
    assert level == "safe" and risk < 10
    assert scoring.overall(0, None) == (0, "safe")


@pytest.mark.parametrize(
    ("rgb", "expected"),
    [((40, 70, 35), True), ((100, 115, 60), True), ((150, 110, 70), False), ((120, 118, 90), False), ((10, 15, 8), False)],
)
def test_vegetation_rule(rgb, expected):
    assert is_vegetation(*rgb) is expected  # trees, grass | laterite, olive roof, shadow


def test_tile_maths_and_path_sampling():
    x, y = world_pixel(0, 0, zoom=1)
    assert (x, y) == (256, 256)
    lat, lng = point_along(PATH, 0.5)
    assert abs(lat - 6.44) < 1e-4 and lng == 7.41


IMAGERY = StretchImagery(views=[b"\xff\xd8\xff\xe0fake"], vegetation_pct=70, captured_on=date(2024, 12, 25), resolution_m=0.34)
ROAD = {"id": "enugu-onitsha-4", "corridor_name": "Enugu–Onitsha Expressway", "ref": "A232", "seq": 4,
        "label": "near Ngwo", "lga": "Udi", "length_m": 4100}


def test_measured_only_fallback_is_capped_and_honest():
    a = assess_mod.measured_only(IMAGERY)
    assert a.method == "imagery" and a.exposure_risk == 56 and a.physical_risk == 0
    assert "haven't been reviewed" in a.summary


REVIEW = {
    "surface": "paved_worn", "settlement": "rural", "vegetation": "dense",
    "hazards": [{"type": "erosion", "severity": 3, "note": "Gully eating into the north-bound shoulder"}],
    "physical_risk": 55, "exposure_risk": 72,
    "summary": "Paved two-lane road through thick bush with few buildings for 3 km.",
    "advice": "Travel in daylight and keep moving through the wooded section.",
    "confidence": 0.8,
}


class _Handler(BaseHTTPRequestHandler):
    captured: dict = {}

    def do_POST(self):  # noqa: N802
        length = int(self.headers["content-length"])
        _Handler.captured = json.loads(self.rfile.read(length))
        reply = json.dumps({
            "id": "msg_test", "type": "message", "role": "assistant", "model": "claude-opus-5-5",
            "content": [{"type": "text", "text": json.dumps(REVIEW)}],
            "stop_reason": "end_turn", "stop_sequence": None, "usage": {"input_tokens": 3000, "output_tokens": 200},
        }).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(reply)))
        self.end_headers()
        self.wfile.write(reply)

    def log_message(self, *args):
        pass


async def test_ai_review_request_and_parsing(monkeypatch):
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", f"http://127.0.0.1:{server.server_port}")
    config.get_settings.cache_clear()
    ai._clients.clear()
    try:
        result = await assess_mod.assess(ROAD, IMAGERY)
    finally:
        server.shutdown()
        config.get_settings.cache_clear()
        ai._clients.clear()

    body = _Handler.captured
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert body["messages"][0]["content"][0]["type"] == "image"
    text = body["messages"][0]["content"][-1]["text"]
    assert "Enugu–Onitsha Expressway (A232)" in text and "25 December 2024" in text and "70%" in text
    assert "Do not claim to see crime" in body["system"]

    assert result.method == "ai"
    assert (result.exposure_risk, result.physical_risk) == (72, 55)
    assert result.hazards[0]["type"] == "erosion"
