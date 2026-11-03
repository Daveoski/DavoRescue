from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.domains.roadpulse.schemas import SignalIn, TripIn
from app.domains.roadpulse.signals import cluster_status
from app.domains.roadpulse.trips import GRACE, trip_state
from app.domains.roadwatch.scoring import with_warnings


def test_one_anonymous_report_stays_private():
    assert cluster_status(sources=1, trusted=False, responder=False, best_existing=None) == "unverified"


def test_two_independent_sources_corroborate():
    assert cluster_status(sources=2, trusted=False, responder=False, best_existing=None) == "corroborated"


def test_trusted_reporter_corroborates_alone():
    assert cluster_status(sources=1, trusted=True, responder=False, best_existing=None) == "corroborated"


def test_responder_confirms_and_status_never_drops():
    assert cluster_status(sources=1, trusted=False, responder=True, best_existing=None) == "confirmed"
    assert cluster_status(sources=1, trusted=False, responder=False, best_existing="confirmed") == "confirmed"
    assert cluster_status(sources=1, trusted=False, responder=False, best_existing="corroborated") == "corroborated"


def test_warnings_lift_road_rating():
    assert with_warnings(10, []) == (10, "safe")
    assert with_warnings(10, ["unverified"]) == (10, "safe")  # rumours don't change public ratings
    assert with_warnings(10, ["corroborated"])[1] == "caution"
    assert with_warnings(10, ["corroborated", "confirmed"])[1] == "avoid"


def test_warning_needs_a_sign_and_other_kinds_drop_it():
    with pytest.raises(ValidationError):
        SignalIn(kind="warning", lat=6.4, lng=7.5)
    assert SignalIn(kind="all_clear", sign="gunshots", lat=6.4, lng=7.5).sign is None


def test_trip_contacts_are_validated_and_capped():
    trip = TripIn(destination="Nsukka", eta_minutes=90, contacts=[{"name": "Mum", "phone": "0803 123 4567"}])
    assert trip.contacts[0].phone == "08031234567"
    with pytest.raises(ValidationError):
        TripIn(destination="Nsukka", eta_minutes=90, contacts=[{"name": f"c{i}", "phone": "08031234567"} for i in range(4)])


TRIP = {
    "destination": "Nsukka",
    "eta": datetime(2026, 11, 3, 17, 30, tzinfo=UTC),
    "message": "Heading out with Chidi in his grey Corolla, will call when I arrive at UNN main gate",
    "last_lat": 6.62,
    "last_lng": 7.41,
}
URL = "https://davorescue.vercel.app/trip/abc123"


def test_started_sms_is_short_and_carries_link_and_note():
    from app.domains.roadpulse.trip_messages import sms_text

    sms = sms_text("started", "Ada", TRIP, URL)
    assert "Ada is travelling to Nsukka, due 18:30" in sms  # shown in Nigeria time
    assert URL in sms and "Heading out with Chidi" in sms
    assert len(sms) <= 2 * 153  # two SMS pages at most


def test_overdue_sms_includes_last_position_and_112():
    from app.domains.roadpulse.trip_messages import sms_text

    sms = sms_text("overdue", "Ada", TRIP, URL)
    assert "hasn't checked in" in sms and "6.620000,7.410000" in sms and "112" in sms


def test_email_escapes_user_text_and_has_live_link():
    from app.domains.roadpulse.trip_messages import email_message

    subject, html, text = email_message("started", "Ada", "Mum", {**TRIP, "message": "<script>alert(1)</script>"}, URL)
    assert subject.startswith("Ada is travelling to Nsukka")
    assert "<script>" not in html and "&lt;script&gt;" in html
    assert "View live location" in html and URL in html and URL in text


def test_deliveries_keep_latest_per_contact_and_channel():
    from app.domains.roadpulse.trips import deliveries

    log = [
        {"event": "started", "to": "Mum", "channel": "sms", "status": "skipped", "detail": "x"},
        {"event": "started", "to": "Mum", "channel": "email", "status": "sent", "detail": "y"},
        {"event": "overdue", "to": "Mum", "channel": "sms", "status": "sent", "detail": "z"},
    ]
    result = {(d["to"], d["channel"]): d for d in deliveries(log)}
    assert result[("Mum", "sms")]["event"] == "overdue" and result[("Mum", "email")]["status"] == "sent"


def test_contact_email_optional_and_message_tidied():
    trip = TripIn(destination="Nsukka", eta_minutes=60, message="  see   you  soon ",
                  contacts=[{"name": "Mum", "phone": "08031234567", "email": ""}])
    assert trip.contacts[0].email is None and trip.message == "see you soon"
    with pytest.raises(ValidationError):
        TripIn(destination="Nsukka", eta_minutes=60, contacts=[{"name": "Mum", "phone": "08031234567", "email": "not-an-email"}])


def test_trip_states():
    eta = datetime(2026, 11, 3, 18, tzinfo=UTC)
    row = {"status": "active", "eta": eta}
    assert trip_state(row, eta - timedelta(minutes=5)) == "on_the_way"
    assert trip_state(row, eta + timedelta(minutes=5)) == "due"
    assert trip_state(row, eta + GRACE + timedelta(minutes=1)) == "overdue"
    assert trip_state({**row, "status": "arrived"}, eta + timedelta(hours=3)) == "arrived"
