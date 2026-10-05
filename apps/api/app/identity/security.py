import hashlib
import re
import secrets
from functools import lru_cache

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Request

from app.core.config import Settings
from app.core.errors import DomainError

SESSION_COOKIE = "dbthon_session"
HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def csrf_token(token: str) -> str:
    return digest("dbthon.csrf.v1:" + token)


@lru_cache(maxsize=1)
def dummy_hash() -> str:
    return HASHER.hash(secrets.token_urlsafe(32))


def matches(hashed: str, password: str) -> bool:
    try:
        return HASHER.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def session_token(request: Request) -> str:
    token = request.cookies.get(SESSION_COOKIE, "")
    if not TOKEN_PATTERN.fullmatch(token):
        raise DomainError("UNAUTHENTICATED", 401, "Sign in to continue.")
    return token


def guard_write(request: Request, settings: Settings) -> None:
    # Required on login/register as well: custom-header protection prevents login CSRF.
    if request.headers.get("X-Requested-With") != "SecondTable":
        raise DomainError("CSRF_INVALID", 403, "Use the application request headers.")
    origin = request.headers.get("Origin")
    if (origin is not None and origin not in settings.allowed_origins) or (
        origin is None and request.headers.get("Sec-Fetch-Site") == "cross-site"
    ):
        raise DomainError("ORIGIN_FORBIDDEN", 403, "The request origin is not permitted.")
