import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.main import create_app


def test_unconfigured_identity_is_closed_and_validation_never_echoes_password():
    settings = Settings(
        _env_file=None,
        database_url=None,
        postgres_password=None,
        app_database_url=None,
        auth_database_url=None,
    )
    with TestClient(create_app(settings)) as client:
        invalid = client.post(
            "/api/v1/auth/login", json={"email": "invalid", "password": "sensitive"}
        )
        assert invalid.status_code == 422 and "sensitive" not in invalid.text
        assert invalid.json()["request_id"] == invalid.headers["x-request-id"]
        response = client.post(
            "/api/v1/auth/login",
            headers={"X-Requested-With": "SecondTable"},
            json={"email": "test@example.com", "password": "test-only-strong-value"},
        )
        assert response.status_code == 503
        assert client.get("/api/v1/auth/me").status_code == 401
        assert client.get("/api/v1/health/ready").status_code == 503


def test_explicit_origin_validation_and_postgresql_only_restricted_urls():
    for invalid in [["*"], ["http://localhost:5173/"], ["https://user:password@app.example.com"]]:
        with pytest.raises(ValidationError):
            Settings(_env_file=None, allowed_origins=invalid)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="production")
    settings = Settings(
        _env_file=None, app_env="production", allowed_origins=["https://app.example.com"]
    )
    assert settings.app_env == "production"
    bad = Settings(_env_file=None, app_database_url=SecretStr("sqlite:///private.db"))
    with pytest.raises(ValueError, match="PostgreSQL"):
        bad.restricted_url("runtime")
