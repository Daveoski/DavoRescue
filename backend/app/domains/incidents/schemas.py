from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.domains.auth.schemas import normalise_ng_phone

Category = Literal["crime", "fire", "medical", "road", "disaster"]
ResponderStatus = Literal["verified", "rejected", "dispatched", "responding", "resolved"]

# ~2.6 MB of base64 ≈ 2 MB image; the client compresses to well under this.
MAX_DATA_URL_CHARS = 2_800_000


class PhotoIn(BaseModel):
    data_url: str = Field(max_length=MAX_DATA_URL_CHARS)
    captured_at: datetime | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    live_capture: bool = False


class IncidentIn(BaseModel):
    category: Category
    subtype: str = Field(min_length=2, max_length=40)
    description: str = Field(min_length=3, max_length=2000)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=100_000)
    injured_count: int | None = Field(default=None, ge=0, le=500)
    anonymous: bool = True
    contact_phone: str | None = None
    photos: list[PhotoIn] = Field(default_factory=list, max_length=3)

    @field_validator("contact_phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalise_ng_phone(v) if v else None

    @field_validator("description", "subtype")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class StatusUpdateIn(BaseModel):
    status: ResponderStatus
    note: str | None = Field(default=None, max_length=500)
