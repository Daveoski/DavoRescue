from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, ValidationInfo, field_validator

from app.core.passwords import MAX_LENGTH, password_problems

Role = Literal["citizen", "responder", "admin"]

_NG_PHONE = re.compile(r"^(?:\+?234|0)([789][01]\d{8})$")


def normalise_ng_phone(raw: str) -> str:
    """Store Nigerian mobile numbers in one canonical local form: 0XXXXXXXXXX."""
    digits = re.sub(r"[\s\-()]", "", raw)
    match = _NG_PHONE.match(digits)
    if not match:
        raise ValueError("Enter a valid Nigerian mobile number, e.g. 0803 123 4567")
    return "0" + match.group(1)


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    phone: str
    email: EmailStr | None = None
    password: str = Field(max_length=MAX_LENGTH)
    invite_code: str | None = Field(default=None, max_length=64)
    agency_slug: str | None = Field(default=None, max_length=64)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalise_ng_phone(v)

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        return " ".join(v.split())

    @field_validator("password")
    @classmethod
    def _strong_password(cls, v: str, info: ValidationInfo) -> str:
        # full_name and phone are declared first, so they're already validated here.
        problems = password_problems(v, full_name=info.data.get("full_name", ""), phone=info.data.get("phone", ""))
        if problems:
            raise ValueError(problems[0])
        return v


class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=120, description="Phone number or email")
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: str
    full_name: str
    phone: str
    email: str | None
    role: Role
    agency_slug: str | None
    alert_radius_km: int
    last_lat: float | None
    last_lng: float | None


class AuthOut(BaseModel):
    token: str
    user: UserOut


class ProfileUpdateIn(BaseModel):
    alert_radius_km: int | None = Field(default=None, ge=1, le=200)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
