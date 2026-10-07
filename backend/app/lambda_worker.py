"""Run restricted expiry/inbox sweeps for one scheduled invocation."""

import time
from typing import Any

from app.core.access import Access
from app.core.config import Settings
from app.workflows.worker import tick


def handle(event: dict[str, Any], context: Any) -> dict[str, int]:
    settings = Settings()
    access = Access(settings)
    totals: dict[str, int] = {}
    until = time.monotonic() + min(int(event.get("duration_seconds", 0)), 50)
    try:
        while True:
            for key, value in tick(access).items():
                totals[key] = totals.get(key, 0) + value
            if time.monotonic() >= until or context.get_remaining_time_in_millis() < 8000:
                return totals
            time.sleep(min(settings.worker_interval_seconds, max(0, until - time.monotonic())))
    finally:
        access.close()
