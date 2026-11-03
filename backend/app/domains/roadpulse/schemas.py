from __future__ import annotations

from datetime import timedelta
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.domains.auth.schemas import normalise_ng_phone

SignalKind = Literal["warning", "turning_back", "all_clear"]
Sign = Literal["loitering", "blockade", "checkpoint", "traffic_stopped", "gunshots", "other"]

SIGN_LABELS: dict[str, str] = {
    "loitering": "People hiding or loitering by the road",
    "blockade": "Road blocked or a vehicle across the road",
    "checkpoint": "Unofficial checkpoint",
    "traffic_stopped": "Traffic suddenly stopped",
    "gunshots": "Gunshots nearby",
    "other": "Something suspicious",
    "turning_back": "Vehicles turning back",
}

# How long a signal stays relevant.
TTL = {"warning": timedelta(hours=2), "turning_back": timedelta(hours=1), "all_clear": timedelta(hours=3)}

# What an escalated warning becomes when a responder confirms it as an incident.
ESCALATION = {
    "loitering": ("crime", "suspicious activity", 3),
    "blockade": ("crime", "road blockade", 4),
    "checkpoint": ("crime", "unofficial checkpoint", 4),
    "traffic_stopped": ("road", "road obstruction", 3),
    "gunshots": ("crime", "gunshots", 5),
    "other": ("crime", "suspicious activity", 3),
    "turning_back": ("road", "road obstruction", 3),
}


class SignalIn(BaseModel):
    kind: SignalKind
    sign: Sign | None = None
    note: str | None = Field(default=None, max_length=280)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=100_000)

    @model_validator(mode="after")
    def _sign_for_warnings(self) -> SignalIn:
        if self.kind == "warning" and self.sign is None:
            raise ValueError("Choose what you saw")
        if self.kind != "warning":
            self.sign = None
        return self


class SignalReviewIn(BaseModel):
    action: Literal["confirm", "dismiss", "escalate"]
    note: str | None = Field(default=None, max_length=280)


class Contact(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalise_ng_phone(v)


class TripIn(BaseModel):
    destination: str = Field(min_length=2, max_length=120)
    eta_minutes: int = Field(ge=10, le=24 * 60)
    contacts: list[Contact] = Field(default_factory=list, max_length=3)


class PingIn(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class ExtendIn(BaseModel):
    minutes: int = Field(ge=5, le=240)
