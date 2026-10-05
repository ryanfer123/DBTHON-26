"""Process due listings and durable in-app notifications with a restricted login."""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api"))

from app.core.access import Access
from app.core.config import Settings
from app.core.errors import DomainError
from app.workflows.worker import tick
from sqlalchemy.exc import SQLAlchemyError


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    settings = Settings()
    if settings.restricted_url("worker") is None:
        raise SystemExit("Run make db-access to configure the restricted worker login.")
    access = Access(settings)
    print("Restricted expiry/inbox worker ready.", flush=True)
    try:
        while True:
            try:
                counts = tick(access)
                if args.once or any(counts.values()):
                    print(counts, flush=True)
            except (SQLAlchemyError, DomainError):
                print(
                    "Worker dependency unavailable; retrying without exposing database details.",
                    flush=True,
                )
                if args.once:
                    raise SystemExit(1) from None
            if args.once:
                break
            time.sleep(settings.worker_interval_seconds)
    except KeyboardInterrupt:
        pass
    finally:
        access.close()


if __name__ == "__main__":
    main()
