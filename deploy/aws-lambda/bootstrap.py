"""Operator-only Lambda migration and synthetic seed; no public URL is attached."""

import os
import runpy
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from alembic import command
from alembic.config import Config
from app.core.config import Settings
from app.core.operator import configure_fixture_admin
from app.core.provision import provision_login
from app.seed import IDENTITIES, import_demo
from sqlalchemy import create_engine, text


def handle(event: dict[str, Any], context: Any) -> dict[str, object]:
    operation = event.get("operation")
    if operation not in {"initialize", "configure_fixture_admin", "migrate"}:
        raise ValueError("Explicit operator operation required")
    settings = Settings()
    owner = settings.connection_url()
    if owner is None:
        raise ValueError("Owner configuration required")
    # Fail before changing anything if unexpected tables or existing member data exist.
    engine = create_engine(owner, hide_parameters=True)
    if operation == "migrate":
        try:
            with engine.connect() as c:
                installed = c.execute(
                    text("SELECT to_regclass('public.alembic_version') IS NOT NULL")
                ).scalar_one()
                if not installed:
                    raise ValueError("An initialized application database is required")
                current = c.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one()
                if current not in {"0005", "0006", "0007"}:
                    raise ValueError(
                        f"Refusing to migrate unexpected revision {current}"
                    )
            if current in {"0005", "0006"}:
                command.upgrade(Config(str(ROOT / "backend/alembic.ini")), "head")
            with engine.connect() as c:
                revision = c.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one()
            return {"migration": revision, "previous_migration": current}
        finally:
            engine.dispose()
    if operation == "configure_fixture_admin":
        try:
            with engine.begin() as c:
                c.execute(text("SET LOCAL ROLE dbthon_guard"))
                return configure_fixture_admin(
                    c, event.get("email", ""), event.get("password_hash", "")
                )
        finally:
            engine.dispose()
    with engine.connect() as c:
        installed = c.execute(
            text("SELECT to_regclass('public.alembic_version') IS NOT NULL")
        ).scalar_one()
        tables = c.execute(
            text(
                "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('spatial_ref_sys')"
            )
        ).scalar_one()
        if not installed and tables:
            raise ValueError("Existing non-application tables require operator review")
    runpy.run_path(str(ROOT / "scripts/prepare_cloud_database.py"), run_name="__main__")
    command.upgrade(Config(str(ROOT / "backend/alembic.ini")), "head")
    with engine.begin() as c:
        c.execute(text("REVOKE CREATE ON SCHEMA public FROM dbthon_guard"))
        # setval needs UPDATE; the function owner normally has only USAGE/SELECT.
        # Grant it only inside this bootstrap transaction, then remove it again.
        for table, column in IDENTITIES.items():
            sequence = c.execute(
                text("SELECT pg_get_serial_sequence(:table,:column)"),
                {"table": table, "column": column},
            ).scalar_one()
            c.execute(text(f"GRANT UPDATE ON SEQUENCE {sequence} TO dbthon_guard"))
        # FORCE RLS remains enabled; only the explicit bootstrap owner may adopt guard.
        c.execute(text("SET LOCAL ROLE dbthon_guard"))
        anchor = c.execute(
            text("SELECT anchor FROM seed_runs WHERE seed_name='demo-v1'")
        ).scalar_one_or_none()
        added = import_demo(c, anchor or datetime.now(UTC).replace(microsecond=0))
        c.execute(text("RESET ROLE"))
        for table, column in IDENTITIES.items():
            sequence = c.execute(
                text("SELECT pg_get_serial_sequence(:table,:column)"),
                {"table": table, "column": column},
            ).scalar_one()
            c.execute(text(f"REVOKE UPDATE ON SEQUENCE {sequence} FROM dbthon_guard"))
    with engine.begin() as c:
        for purpose, user, variable in [
            ("auth", "dbthon_identity", "DB_AUTH_PASSWORD"),
            ("runtime", "dbthon_app", "DB_RUNTIME_PASSWORD"),
            ("worker", "dbthon_jobs", "DB_WORKER_PASSWORD"),
        ]:
            provision_login(
                c.connection.driver_connection, user, purpose, os.environ[variable]
            )
    engine.dispose()
    return {"initialized": True, "synthetic_seed_added": added, "migration": "0004"}
