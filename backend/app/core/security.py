from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import get_settings

_ALGORITHM = "HS256"
# Crockford-style alphabet: no 0/O, 1/I/L confusion when read out over a phone call.
_REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_access_token(user_id: str, role: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_ttl_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGORITHM])
    except jwt.PyJWTError:
        return None


def fingerprint(ip: str) -> str:
    """Salted hash so anonymous reporters can be rate-limited without storing their IP."""
    salt = get_settings().ip_hash_salt
    return hashlib.sha256(f"{salt}:{ip}".encode()).hexdigest()[:32]


def new_incident_ref() -> str:
    return "DR-" + "".join(secrets.choice(_REF_ALPHABET) for _ in range(6))
