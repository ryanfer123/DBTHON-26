"""Bounded Web Push transport. Database transactions finish before network calls."""

from typing import Any

from sqlalchemy import text

from app.core.access import Access
from app.core.config import Settings


def lease_push(access: Access) -> list[dict[str, str | int]]:
    with access.transaction("worker") as c:
        return [
            {key: str(value) if key == "lease_token" else value for key, value in row.items()}
            for row in c.execute(text("SELECT * FROM dbthon_lease_browser_push()")).mappings()
        ]


def finish_push(access: Access, job: dict[str, Any], outcome: str) -> None:
    with access.transaction("worker") as c:
        c.execute(
            text("SELECT dbthon_finish_browser_push(:id,:token,:outcome)"),
            {"id": job["delivery_id"], "token": job["lease_token"], "outcome": outcome},
        )


def send_push(job: dict[str, Any], settings: Settings) -> str:
    # Revalidate DB values as defense in depth against endpoint SSRF.
    from app.routes.push import Endpoint

    if not settings.push_private_key:
        return "Failed"
    import requests
    from pywebpush import WebPushException, webpush

    class NoRedirectSession(requests.Session):
        def request(self, *args: Any, **kwargs: Any) -> Any:
            kwargs["allow_redirects"] = False
            return super().request(*args, **kwargs)

    try:
        Endpoint(endpoint=job["endpoint"])
        with NoRedirectSession() as client:
            response = webpush(
                subscription_info={
                    "endpoint": job["endpoint"],
                    "keys": {"p256dh": job["p256dh"], "auth": job["auth"]},
                },
                data='{"type":"inbox_update"}',
                vapid_private_key=settings.push_private_key.get_secret_value(),
                vapid_claims={"sub": settings.push_subject},
                ttl=300,
                timeout=5,
                requests_session=client,
            )
            return "Accepted" if 200 <= response.status_code < 300 else "Failed"
    except WebPushException as error:
        return (
            "Gone"
            if error.response is not None and error.response.status_code in (404, 410)
            else "Failed"
        )
    except Exception:
        # Never log provider exceptions: they can contain endpoint capabilities.
        return "Failed"


def deliver_push(access: Access, settings: Settings) -> dict[str, int]:
    counts = {"push_accepted": 0, "push_failed": 0}
    if not settings.push_delivery_enabled or not settings.push_private_key:
        return counts
    for job in lease_push(access):
        outcome = send_push(job, settings)
        finish_push(access, job, outcome)
        counts["push_accepted" if outcome == "Accepted" else "push_failed"] += 1
    return counts
