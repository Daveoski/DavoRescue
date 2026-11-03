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


def test_trip_states():
    eta = datetime(2026, 11, 3, 18, tzinfo=UTC)
    row = {"status": "active", "eta": eta}
    assert trip_state(row, eta - timedelta(minutes=5)) == "on_the_way"
    assert trip_state(row, eta + timedelta(minutes=5)) == "due"
    assert trip_state(row, eta + GRACE + timedelta(minutes=1)) == "overdue"
    assert trip_state({**row, "status": "arrived"}, eta + timedelta(hours=3)) == "arrived"
