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
    tls = settings.model_copy(update={"app_database_url": SecretStr("postgresql://localhost/test")})
    assert tls.restricted_url("runtime").query["sslmode"] == "require"
    bad = Settings(_env_file=None, app_database_url=SecretStr("sqlite:///private.db"))
    with pytest.raises(ValueError, match="PostgreSQL"):
        bad.restricted_url("runtime")


def test_cross_origin_render_api_preflight_and_write_origin_allowlist():
    app_origin = "https://dbthon-26-web.onrender.com"
    settings = Settings(
        _env_file=None,
        app_env="production",
        allowed_origins=[app_origin],
        database_url=None,
        postgres_password=None,
        app_database_url=None,
        auth_database_url=None,
    )
    with TestClient(create_app(settings)) as client:
        preflight = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": app_origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": (
                    "content-type,x-requested-with,x-csrf-token,idempotency-key"
                ),
            },
        )
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == app_origin
        assert preflight.headers["access-control-allow-credentials"] == "true"

        allowed = client.post(
            "/api/v1/auth/login",
            headers={
                "Origin": app_origin,
                "Sec-Fetch-Site": "cross-site",
                "X-Requested-With": "SecondTable",
            },
            json={"email": "test@example.com", "password": "test-only-strong-value"},
        )
        assert allowed.status_code == 503
        assert "Retry-After" in allowed.headers["access-control-expose-headers"]

        rejected = client.post(
            "/api/v1/auth/login",
            headers={
                "Origin": "https://untrusted.example",
                "Sec-Fetch-Site": "cross-site",
                "X-Requested-With": "SecondTable",
            },
            json={"email": "test@example.com", "password": "test-only-strong-value"},
        )
        assert rejected.status_code == 403


def test_cross_site_without_origin_is_denied_even_with_custom_header():
    with TestClient(create_app(Settings(_env_file=None, postgres_password=None))) as client:
        rejected = client.post(
            "/api/v1/auth/login",
            headers={"Sec-Fetch-Site": "cross-site", "X-Requested-With": "SecondTable"},
            json={"email": "test@example.invalid", "password": "test-only-strong-value"},
        )
        assert rejected.status_code == 403
