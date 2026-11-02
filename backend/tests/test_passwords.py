from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.passwords import password_problems
from app.domains.auth.schemas import RegisterIn


@pytest.mark.parametrize("password", ["Coal-City#Rain72", "Udi*Hills-2026x", "bL7!rq-Ok29zz"])
def test_strong_passwords_pass(password):
    assert password_problems(password, full_name="Ada Okafor", phone="08031234567") == []


@pytest.mark.parametrize(
    ("password", "problem"),
    [
        ("Short1!", "at least 10 characters"),
        ("alllowercase1!", "upper- and lower-case"),
        ("NoNumbersHere!", "number"),
        ("NoSymbols12345", "symbol"),
        ("Password123!", "too common"),
        ("Enugu2026!!", "too common"),
        ("Okafor#Strong9", "your name"),
        ("Xx!3123456721", "phone number"),
    ],
)
def test_weak_passwords_explain_why(password, problem):
    problems = password_problems(password, full_name="Ada Okafor", phone="08031234567")
    assert any(problem in p for p in problems), problems


def test_register_rejects_weak_password_with_readable_message():
    with pytest.raises(ValidationError) as exc:
        RegisterIn(full_name="Ada Okafor", phone="08031234567", password="password1")
    assert "at least 10 characters" in str(exc.value)


def test_register_accepts_strong_password():
    data = RegisterIn(full_name="Ada Okafor", phone="0803 123 4567", password="Coal-City#Rain72")
    assert data.phone == "08031234567"
