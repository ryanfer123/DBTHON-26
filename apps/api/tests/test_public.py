from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.database import Database
from app.main import create_app


def test_liveness_does_not_pretend_the_database_is_ready():
    settings = Settings(_env_file=None, postgres_password=None, database_url=None)
    with TestClient(create_app(settings, Database(settings))) as client:
        live = client.get("/api/v1/health/live")
        assert live.status_code == 200
        assert live.json() == {"data": {"status": "alive"}}
        assert len(live.headers["x-request-id"]) == 32
        ready = client.get("/api/v1/health/ready")
        assert ready.status_code == 503
        assert ready.json()["error"]["code"] == "SERVICE_NOT_READY"
        assert ready.json()["request_id"] == ready.headers["x-request-id"]
        assert ready.headers["retry-after"] == "5"


def test_public_introduction_has_no_mock_transaction_or_private_identity():
    with TestClient(
        create_app(Settings(_env_file=None, postgres_password=None, database_url=None))
    ) as client:
        result = client.get("/api/v1/community")
        assert result.status_code == 200
        assert [r["id"] for r in result.json()["data"]["roles"]] == [
            "donor",
            "receiver",
            "volunteer",
        ]
        assert "password" not in result.text.lower()
        assert "24BCE" not in result.text


def test_openapi_lists_only_implemented_endpoints():
    with TestClient(
        create_app(Settings(_env_file=None, postgres_password=None, database_url=None))
    ) as client:
        paths = client.get("/api/openapi.json").json()["paths"]
        assert set(paths) == {"/api/v1/health/live", "/api/v1/health/ready", "/api/v1/community"}
