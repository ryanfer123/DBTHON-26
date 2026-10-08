"""Own-browser subscription APIs; never expose stored endpoint capabilities."""

import base64
from urllib.parse import urlsplit

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text

from app.core.errors import DomainError
from app.routes.identity import context

router = APIRouter(tags=["Browser push"])


class Endpoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    endpoint: str = Field(min_length=1, max_length=2048)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        url = urlsplit(value)
        host = url.hostname or ""
        approved = host in {
            "fcm.googleapis.com",
            "updates.push.services.mozilla.com",
            "web.push.apple.com",
        } or host.endswith(".notify.windows.com")
        if (
            url.scheme != "https"
            or url.username
            or url.password
            or url.fragment
            or url.port not in (None, 443)
            or not approved
        ):
            raise ValueError("Use a supported browser push endpoint")
        return value


class Keys(BaseModel):
    model_config = ConfigDict(extra="forbid")
    p256dh: str = Field(max_length=100)
    auth: str = Field(max_length=30)

    @field_validator("p256dh", "auth")
    @classmethod
    def validate_key(cls, value: str) -> str:
        # Validation is completed by the subscription model below.
        if not value or any(
            c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_="
            for c in value
        ):
            raise ValueError("Invalid subscription encoding")
        return value


class Subscription(Endpoint):
    keys: Keys
    expirationTime: float | None = None


@router.get("/push/config")
def config(request: Request) -> dict[str, object]:
    with context(request):
        settings = request.app.state.settings
        return {
            "data": {
                "configured": settings.push_delivery_enabled and bool(settings.push_public_key),
                "public_key": settings.push_public_key,
            }
        }


@router.post("/push/status")
def status(body: Endpoint, request: Request) -> dict[str, object]:
    with context(request, write=True) as c:
        enabled = c.execute(
            text("SELECT dbthon_push_status(:endpoint)"), {"endpoint": body.endpoint}
        ).scalar_one()
        return {"data": {"enabled": bool(enabled)}}


@router.post("/push/subscribe")
def subscribe(body: Subscription, request: Request) -> dict[str, object]:
    settings = request.app.state.settings
    if not settings.push_delivery_enabled or not settings.push_public_key:
        raise DomainError("PUSH_UNAVAILABLE", 503, "Browser push is awaiting server setup.")
    from cryptography.hazmat.primitives.asymmetric.ec import SECP256R1, EllipticCurvePublicKey

    try:
        point = base64.urlsafe_b64decode(body.keys.p256dh + "=" * (-len(body.keys.p256dh) % 4))
        auth = base64.urlsafe_b64decode(body.keys.auth + "=" * (-len(body.keys.auth) % 4))
        if len(point) != 65 or len(auth) != 16:
            raise ValueError
        EllipticCurvePublicKey.from_encoded_point(SECP256R1(), point)
    except ValueError as error:
        raise DomainError("INVALID_SUBSCRIPTION", 422, "Invalid browser subscription.") from error
    with context(request, write=True) as c:
        c.execute(
            text("SELECT dbthon_push_subscribe(:endpoint,:p256dh,:auth)"),
            {"endpoint": body.endpoint, **body.keys.model_dump()},
        )
    return {"data": {"enabled": True}}


@router.post("/push/unsubscribe")
def unsubscribe(body: Endpoint, request: Request) -> dict[str, object]:
    with context(request, write=True) as c:
        c.execute(text("SELECT dbthon_push_unsubscribe(:endpoint)"), {"endpoint": body.endpoint})
    return {"data": {"enabled": False}}
