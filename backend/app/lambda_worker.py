"""Run restricted expiry/inbox sweeps for one scheduled invocation."""

import time
from typing import Any

from app.core.access import Access
from app.core.config import Settings
from app.workflows.browser_push import finish_push, lease_push
from app.workflows.worker import tick


def handle(event: dict[str, Any], context: Any) -> dict[str, Any]:
    settings = Settings()
    access = Access(settings)
    totals: dict[str, int] = {}
    until = time.monotonic() + min(int(event.get("duration_seconds", 0)), 50)
    try:
        # IAM-only Lambda invocation; this handler has no HTTP/Function URL.
        if event.get("operation") == "lease_push":
            return {"jobs": lease_push(access) if settings.push_delivery_enabled else []}
        if event.get("operation") == "finish_push":
            finish_push(access, event["job"], event["outcome"])
            return {"finished": True}
        while True:
            for key, value in tick(access, settings=settings).items():
                totals[key] = totals.get(key, 0) + value
            if time.monotonic() >= until or context.get_remaining_time_in_millis() < 8000:
                return totals
            time.sleep(min(settings.worker_interval_seconds, max(0, until - time.monotonic())))
    finally:
        access.close()
