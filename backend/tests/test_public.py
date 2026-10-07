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
        assert set(paths) == {
            "/api/v1/health/live",
            "/api/v1/health/ready",
            "/api/v1/community",
            "/api/v1/public/impact",
            "/api/v1/listings/{listing_id}/photo",
            "/api/v1/admin/listings/{listing_id}/photo/remove",
            "/api/v1/zones",
            "/api/v1/auth/register",
            "/api/v1/auth/login",
            "/api/v1/auth/me",
            "/api/v1/auth/session",
            "/api/v1/auth/logout",
            "/api/v1/account/confirm-zone",
            "/api/v1/admin/users",
            "/api/v1/admin/users/{user_id}/verify",
            "/api/v1/workspace/overview",
            "/api/v1/requests",
            "/api/v1/requests/{request_id}",
            "/api/v1/requests/{request_id}/offers",
            "/api/v1/requests/{request_id}/close",
            "/api/v1/claims/{claim_id}/pickups/{pickup_id}/schedule",
            "/api/v1/community/updates",
            "/api/v1/community/suggestions",
            "/api/v1/community/suggestions/mine",
            "/api/v1/admin/community/suggestions",
            "/api/v1/admin/community/suggestions/{suggestion_id}/publish",
            "/api/v1/admin/community/suggestions/{suggestion_id}/reject",
            "/api/v1/admin/community/updates",
            "/api/v1/admin/community/updates/{update_id}/archive",
            "/api/v1/listings",
            "/api/v1/listings/mine",
            "/api/v1/listings/{listing_id}",
            "/api/v1/listings/{listing_id}/cancel",
            "/api/v1/listings/{listing_id}/claims",
            "/api/v1/claims/mine",
            "/api/v1/claims/{claim_id}",
            "/api/v1/claims/{claim_id}/cancel",
            "/api/v1/pickup-tasks",
            "/api/v1/pickups/mine",
            "/api/v1/claims/{claim_id}/pickups",
            "/api/v1/claims/{claim_id}/pickups/{pickup_id}/cancel",
            "/api/v1/claims/{claim_id}/pickups/{pickup_id}/picked-up",
            "/api/v1/claims/{claim_id}/pickups/{pickup_id}/delivered",
            "/api/v1/admin/claims",
            "/api/v1/admin/claims/{claim_id}/fail",
            "/api/v1/claims/{claim_id}/ratings",
            "/api/v1/notifications",
            "/api/v1/notifications/clear",
            "/api/v1/notifications/{notification_id}/read",
            "/api/v1/settings/notifications",
            "/api/v1/listings/{listing_id}/hide-cancelled",
            "/api/v1/users/{user_id}/trust",
            "/api/v1/trust-ledger/mine",
            "/api/v1/trust-ledger/mine/verification",
            "/api/v1/admin/users/{user_id}/trust-ledger",
            "/api/v1/admin/users/{user_id}/admin",
            "/api/v1/admin/impact",
            "/api/v1/admin/impact/export",
        }


def test_anonymous_session_snapshot_is_normal_and_private():
    with TestClient(create_app(Settings(_env_file=None, postgres_password=None))) as client:
        result = client.get("/api/v1/auth/session")
        assert result.status_code == 200 and result.json() == {"data": None}
        assert result.headers["cache-control"] == "private, no-store"
        client.cookies.set("dbthon_session", "malformed", path="/api/v1")
        assert client.get("/api/v1/auth/session").json() == {"data": None}
        # A plausible cookie must be checked; missing DB configuration is not signed-out.
        client.cookies.set("dbthon_session", "a" * 43, path="/api/v1")
        assert client.get("/api/v1/auth/session").status_code == 503
