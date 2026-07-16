"""Password hashing (bcrypt) and JWT encode/decode.

Uses the `bcrypt` library directly rather than passlib: passlib 1.7.4's bcrypt
backend is incompatible with the pinned bcrypt 5.0.0 (it fails to load), so it is
not used anywhere in this app.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# bcrypt only considers the first 72 bytes of a password; bcrypt 5.x raises on
# longer input instead of truncating, so we truncate explicitly and consistently
# in both hash and verify.
_BCRYPT_MAX_BYTES = 72


def _prepare(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prepare(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_prepare(plain_password), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed/empty stored hash — treat as a failed match, never crash login.
        return False


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """Encode a JWT with `sub=subject` (the user's email) and an expiry claim."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """Return the `sub` (email) from a valid token, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    return payload.get("sub")
