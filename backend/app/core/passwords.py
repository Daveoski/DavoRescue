"""Password policy shared by sign-up validation. Mirrors frontend/src/domains/auth/password.ts."""

from __future__ import annotations

import re

MIN_LENGTH = 10
MAX_LENGTH = 128

# Passwords (or bases with digits/symbols tacked on) that appear at the top of
# every breach list, plus local favourites.
_COMMON_BASES = frozenset({
    "password", "passw0rd", "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbnm", "abc", "abcdef", "abcd",
    "admin", "administrator", "welcome", "letmein", "iloveyou", "monkey", "dragon", "football", "baseball",
    "sunshine", "princess", "master", "shadow", "superman", "trustno", "freedom", "whatever", "login",
    "nigeria", "naija", "enugu", "lagos", "abuja", "jesus", "jesuslovesme", "godisgood", "blessing", "davorescue",
})
_COMMON_EXACT = frozenset({
    "123456", "1234567", "12345678", "123456789", "1234567890", "0123456789", "111111", "000000", "123123",
    "987654321", "1q2w3e4r", "1qaz2wsx", "qwerty123", "password1", "password123", "p@ssw0rd", "p@ssword1",
})


def password_problems(password: str, *, full_name: str = "", phone: str = "") -> list[str]:
    """Human-readable reasons a password is too weak; empty when it passes."""
    problems: list[str] = []
    if len(password) < MIN_LENGTH:
        problems.append(f"Use at least {MIN_LENGTH} characters")
    if len(password) > MAX_LENGTH:
        problems.append(f"Use at most {MAX_LENGTH} characters")
    if not (re.search(r"[a-z]", password) and re.search(r"[A-Z]", password)):
        problems.append("Mix upper- and lower-case letters")
    if not re.search(r"\d", password):
        problems.append("Add at least one number")
    if not re.search(r"[^A-Za-z0-9]", password):
        problems.append("Add at least one symbol, such as ! @ # ?")

    lowered = password.lower()
    base = re.sub(r"[\d\W_]+$", "", re.sub(r"^[\d\W_]+", "", lowered))
    if lowered in _COMMON_EXACT or base in _COMMON_BASES or len(set(password)) <= 3:
        problems.append("That password is too common — choose something less predictable")

    names = [part for part in re.split(r"[\s\-']+", full_name.lower()) if len(part) >= 3]
    if any(part in lowered for part in names):
        problems.append("Don't include your name")
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 7 and (digits[-7:] in password or digits[1:] in password):
        problems.append("Don't include your phone number")
    return problems
