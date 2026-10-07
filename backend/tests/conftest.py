"""Opt-in real database tests; reset only an allowlisted disposable test database."""

import os
import secrets
from contextlib import contextmanager
from datetime import UTC, datetime

import pytest
from alembic import command
from alembic.config import Config
from pydantic import SecretStr
from sqlalchemy import create_engine, text

from app.core.config import ROOT, Settings
from app.core.provision import provision_login
from app.identity.security import digest
from app.seed import import_demo


def pytest_addoption(parser):
    parser.addoption("--db", action="store_true", help="Run real PostgreSQL tests in dbthon_test")


def pytest_collection_modifyitems(config, items):
    if not config.getoption("--db"):
        for item in items:
            if "database" in item.keywords:
                item.add_marker(pytest.mark.skip(reason="Enable real PostgreSQL tests with --db"))


@pytest.fixture(scope="session")
def db_engine():
    url = Settings().connection_url()
    if url is None:
        pytest.fail("Configure local PostGIS before using --db")
    name = os.environ.get("DBTHON_TEST_DATABASE", "dbthon_test")
    if name not in {"dbthon_test", "dbthon_usability_test"}:
        pytest.fail("Only the two named disposable test databases are allowed")
    test_url = url.set(database=name)
    with create_engine(url, isolation_level="AUTOCOMMIT", hide_parameters=True).connect() as c:
        if (
            c.execute(text("SELECT 1 FROM pg_database WHERE datname=:name"), {"name": name}).first()
            is None
        ):
            c.execute(text(f'CREATE DATABASE "{name}"'))
    engine = create_engine(test_url, hide_parameters=True, pool_size=6)
    config = Config(str(ROOT / "backend/alembic.ini"))
    with engine.connect() as c:
        config.attributes["connection"] = c
        command.upgrade(config, "head")
        c.commit()
    yield engine
    engine.dispose()


@pytest.fixture
def seeded_db(db_engine):
    # This fixture never receives a caller-selected database or schema.
    assert db_engine.url.database in {"dbthon_test", "dbthon_usability_test"}
    with db_engine.begin() as c:
        c.execute(
            text("""
          TRUNCATE donor_schedules,external_alert_budget,
            pickup_confirmations,pickup_proposals,food_request_offers,food_requests,
            hidden_listings,notification_preferences,admin_grants,
            community_suggestions,community_updates,listing_photos,verification_reviews,auth_rate_limits,seed_runs,
            idempotency_keys,sessions,
            notification_outbox,notifications,
            trust_ledger,ratings,pickups,claims,food_listings,receiver_profiles,user_roles,
            users,zones RESTART IDENTITY
        """)
        )
        import_demo(c, datetime.now(UTC).replace(microsecond=0))
    return db_engine


@contextmanager
def actor(engine, uid, session_seconds=3600):
    session_hash = secrets.token_hex(32)
    csrf_hash = digest(secrets.token_urlsafe(32))
    with engine.begin() as c:
        c.execute(
            text("""
          INSERT INTO sessions(session_hash,user_id,expires_at,csrf_hash)
          VALUES(:session,:uid,clock_timestamp()+make_interval(secs=>:seconds),:csrf)
        """),
            {"session": session_hash, "uid": uid, "seconds": session_seconds, "csrf": csrf_hash},
        )
    with engine.begin() as c:
        c.execute(text("SET LOCAL ROLE dbthon_runtime"))
        c.execute(
            text("SELECT set_config('app.session_hash',:session,true)"), {"session": session_hash}
        )
        c.execute(text("SET LOCAL lock_timeout='5s'"))
        c.execute(text("SELECT set_config('app.csrf_hash',:csrf,true)"), {"csrf": csrf_hash})
        c.execute(text("SET LOCAL statement_timeout='8s'"))
        yield c


@pytest.fixture(scope="session")
def identity_settings(db_engine):
    urls = {}
    with db_engine.begin() as c:
        for purpose, name in [
            ("runtime", "dbthon_test_runtime"),
            ("auth", "dbthon_test_auth"),
            ("worker", "dbthon_test_worker"),
        ]:
            password = secrets.token_urlsafe(36)
            provision_login(c.connection.driver_connection, name, purpose, password)
            urls[purpose] = db_engine.url.set(username=name, password=password)
    return Settings(
        _env_file=None,
        app_env="test",
        postgres_password=None,
        database_url=SecretStr(db_engine.url.render_as_string(hide_password=False)),
        app_database_url=SecretStr(urls["runtime"].render_as_string(hide_password=False)),
        auth_database_url=SecretStr(urls["auth"].render_as_string(hide_password=False)),
        worker_database_url=SecretStr(urls["worker"].render_as_string(hide_password=False)),
    )
