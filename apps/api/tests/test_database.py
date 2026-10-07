import pytest
from pydantic import SecretStr
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.core.database import Database


def test_settings_support_reserved_characters_without_string_interpolation():
    settings = Settings(
        _env_file=None,
        database_url=None,
        postgres_password=SecretStr("test@/:#password"),
    )
    url = settings.connection_url()
    assert url is not None
    assert url.password == "test@/:#password"
    assert "test@" not in str(url)


def test_non_postgresql_configuration_is_rejected():
    with pytest.raises(ValueError, match="requires PostgreSQL"):
        Settings(_env_file=None, database_url=SecretStr("sqlite:///test.db")).connection_url()


def test_readiness_redacts_connection_failures(monkeypatch):
    settings = Settings(_env_file=None, postgres_password=SecretStr("test-only"))
    database = Database(settings)

    def connection_failure():
        raise OperationalError("sensitive host", {}, Exception("sensitive connection detail"))

    monkeypatch.setattr(database.engine, "connect", connection_failure)
    assert database.ready() is False
    database.close()
