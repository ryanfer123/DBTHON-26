"""Run the browser suite against an isolated, resettable synthetic database."""

import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from threading import Event, Thread

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api"))

import uvicorn
from alembic import command
from alembic.config import Config
from app.core.access import Access
from app.core.config import ROOT, Settings
from app.core.errors import DomainError
from app.identity.security import HASHER
from app.main import create_app
from app.seed import import_demo
from app.workflows.worker import tick
from pydantic import SecretStr
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


def main() -> None:
    settings = Settings()
    password = os.environ.get("DBTHON_E2E_PASSWORD", "")
    if settings.app_env == "production" or len(password) < 12:
        raise SystemExit(
            "Browser tests require local configuration and an ephemeral password."
        )
    owner = settings.connection_url()
    runtime = settings.restricted_url("runtime")
    auth = settings.restricted_url("auth")
    worker = settings.restricted_url("worker")
    if owner is None or runtime is None or auth is None or worker is None:
        raise SystemExit("Configure local PostgreSQL and run make db-access first.")
    # Only these explicitly allowlisted disposable databases may be created or reset.
    name = os.environ.get("DBTHON_BROWSER_TEST_DATABASE", "dbthon_browser_test")
    if name not in {"dbthon_browser_test", "dbthon_usability_browser_test"}:
        raise SystemExit("Only the named disposable browser databases are allowed.")
    bootstrap = create_engine(owner, isolation_level="AUTOCOMMIT", hide_parameters=True)
    with bootstrap.connect() as c:
        if not c.execute(
            text("SELECT 1 FROM pg_database WHERE datname=:name"), {"name": name}
        ).first():
            c.execute(text(f'CREATE DATABASE "{name}"'))
    bootstrap.dispose()
    engine = create_engine(owner.set(database=name), hide_parameters=True)
    config = Config(str(ROOT / "apps/api/alembic.ini"))
    with engine.connect() as c:
        config.attributes["connection"] = c
        command.upgrade(config, "head")
        c.commit()
    with engine.begin() as c:
        c.execute(
            text("""
          TRUNCATE pickup_confirmations,pickup_proposals,food_request_offers,food_requests,
            community_suggestions,community_updates,listing_photos,verification_reviews,auth_rate_limits,seed_runs,idempotency_keys,sessions,
            notification_outbox,notifications,trust_ledger,ratings,pickups,claims,
            food_listings,receiver_profiles,user_roles,users,zones RESTART IDENTITY
        """)
        )
        import_demo(c, datetime.now(UTC).replace(microsecond=0))
        c.execute(
            text(
                "UPDATE users SET password_hash=:hash WHERE user_id IN (101,102,103,104,105,107,108)"
            ),
            {"hash": HASHER.hash(password)},
        )
    engine.dispose()
    isolated = Settings(
        _env_file=None,
        app_env="test",
        database_url=SecretStr(
            owner.set(database=name).render_as_string(hide_password=False)
        ),
        app_database_url=SecretStr(
            runtime.set(database=name).render_as_string(hide_password=False)
        ),
        auth_database_url=SecretStr(
            auth.set(database=name).render_as_string(hide_password=False)
        ),
        worker_database_url=SecretStr(
            worker.set(database=name).render_as_string(hide_password=False)
        ),
        allowed_origins=["http://127.0.0.1:5174", "http://127.0.0.1:8001"],
    )
    print("Browser test database prepared; local/demo databases preserved.")
    stop = Event()

    def process_updates() -> None:
        access = Access(isolated)
        try:
            while not stop.is_set():
                try:
                    tick(access)
                except (SQLAlchemyError, DomainError):
                    print("Isolated browser worker will retry processing.")
                stop.wait(2)
        finally:
            access.close()

    thread = Thread(target=process_updates, daemon=True)
    thread.start()
    try:
        uvicorn.run(create_app(isolated), host="127.0.0.1", port=8001)
    finally:
        stop.set()
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
