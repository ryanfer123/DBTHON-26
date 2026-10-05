"""T01/T02 through real API requests and distinct non-owner database logins."""

import secrets
from contextlib import ExitStack

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.access import Access
from app.core.config import ROOT, Settings
from app.core.errors import DomainError
from app.identity.security import HASHER, SESSION_COOKIE, csrf_token, digest
from app.main import create_app
from app.trust.verify import verify

pytestmark = pytest.mark.database
HEADERS = {"X-Requested-With": "SecondTable", "Origin": "http://127.0.0.1:5173"}


@pytest.fixture
def identity(seeded_db, identity_settings):
    password = secrets.token_urlsafe(24)
    with seeded_db.begin() as c:
        c.execute(
            text(
                "UPDATE users SET password_hash=:hash "
                "WHERE user_id IN (101,102,104,106,107,202,204)"
            ),
            {"hash": HASHER.hash(password)},
        )
    with ExitStack() as stack:

        def client(settings=None, base_url="http://testserver"):
            return stack.enter_context(
                TestClient(
                    create_app(settings or identity_settings), base_url=base_url, headers=HEADERS
                )
            )

        yield seeded_db, password, client, identity_settings


def sign_in(client, password, email="z1.receiver@example.invalid"):
    result = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert result.status_code == 200, result.text
    client.headers["X-CSRF-Token"] = result.json()["data"]["csrf_token"]
    return result


def registration(password, **changes):
    body = {
        "name": "  Synthetic new receiver  ",
        "email": "NEW.RECEIVER@example.com",
        "phone": "+12025550999",
        "password": password,
        "zone_id": 1,
        "roles": ["Receiver"],
        "latitude": "12.9692",
        "longitude": "79.1559",
        "capacity_kg": "12.00",
    }
    return {**body, **changes}


def test_register_hashes_password_pending_roles_and_atomic_audit(identity):
    db, password, make, _ = identity
    client = make()
    result = client.post("/api/v1/auth/register", json=registration(password))
    assert result.status_code == 201, result.text
    user = result.json()["data"]
    assert user["email"] == "new.receiver@example.com" and user["name"] == "Synthetic new receiver"
    assert not user["verified_status"] and user["capabilities"] == []
    assert user["roles"] == [{"role": "Receiver", "approved": False}]
    assert "password" not in result.text and password not in result.text
    with db.connect() as c:
        row = c.execute(
            text("SELECT password_hash FROM users WHERE user_id=:uid"), {"uid": user["user_id"]}
        ).scalar_one()
        assert row.startswith("$argon2id$") and HASHER.verify(row, password)
        assert c.execute(text("SELECT count(*) FROM notification_outbox")).scalar_one() == 1
        assert (
            verify(
                c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings()
            )
            == 21
        )
    sign_in(client, password, "new.receiver@example.com")
    assert client.get("/api/v1/auth/me").json()["data"]["user"]["capabilities"] == []
    assert client.get("/api/v1/admin/users").status_code == 403


@pytest.mark.parametrize(
    "changes",
    [
        {"roles": ["Admin"]},
        {"verified_status": True},
        {"approved_by": 104},
        {"active": True},
        {"capacity_kg": None},
        {"capacity_kg": "0"},
        {"latitude": "91"},
        {"roles": ["Receiver", "Receiver"]},
    ],
)
def test_registration_rejects_escalation_and_invalid_profiles(identity, changes):
    db, password, make, _ = identity
    result = make().post("/api/v1/auth/register", json=registration(password, **changes))
    assert result.status_code == 422
    assert password not in result.text
    with db.connect() as c:
        assert c.execute(text("SELECT count(*) FROM users")).scalar_one() == 20
        assert c.execute(text("SELECT count(*) FROM trust_ledger")).scalar_one() == 20


def test_unique_normalized_contacts_roll_back_all_registration_writes(identity):
    db, password, make, _ = identity
    client = make()
    assert client.post("/api/v1/auth/register", json=registration(password)).status_code == 201
    for change in [
        {"email": " New.Receiver@Example.Com ", "phone": "+12025550888"},
        {"email": "another@example.com"},
    ]:
        result = client.post("/api/v1/auth/register", json=registration(password, **change))
        assert result.status_code == 409, result.text
    with db.connect() as c:
        assert c.execute(text("SELECT count(*) FROM users")).scalar_one() == 21
        assert c.execute(text("SELECT count(*) FROM trust_ledger")).scalar_one() == 21
        assert c.execute(text("SELECT count(*) FROM notification_outbox")).scalar_one() == 1


def test_login_cookie_session_hash_csrf_and_logout_revocation(identity):
    db, password, make, _ = identity
    client = make()
    result = sign_in(client, password)
    cookie = result.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/api/v1" in cookie
    assert "Max-Age=43200" in cookie and result.headers["cache-control"] == "private, no-store"
    token = client.cookies.get(SESSION_COOKIE)
    assert "password_hash" not in result.text and token not in result.text
    assert client.get("/api/v1/auth/me").json()["data"]["user"]["user_id"] == 102
    snapshot = client.get("/api/v1/auth/session")
    assert snapshot.status_code == 200 and snapshot.json() == result.json()
    assert snapshot.headers["cache-control"] == "private, no-store"
    with db.connect() as c:
        session = c.execute(
            text("SELECT session_hash,csrf_hash FROM sessions WHERE user_id=102")
        ).one()
        assert session.session_hash == digest(token) and session.csrf_hash == digest(
            csrf_token(token)
        )
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/session").json() == {"data": None}
    client.cookies.set(SESSION_COOKIE, token, path="/api/v1")
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/session").json() == {"data": None}
    with db.connect() as c:
        assert (
            verify(
                c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings()
            )
            == 22
        )


def test_missing_wrong_csrf_and_cross_origin_writes_leave_no_events(identity):
    db, password, make, _ = identity
    client = make()
    sign_in(client, password)
    for headers in [
        {"X-CSRF-Token": ""},
        {"X-CSRF-Token": "wrong"},
        {"Origin": "https://evil.example"},
        {"X-Requested-With": ""},
        {"Origin": "", "Sec-Fetch-Site": "cross-site"},
    ]:
        result = client.patch("/api/v1/auth/me", json={"name": "Changed"}, headers=headers)
        assert result.status_code == 403, result.text
    unauthenticated = make()
    assert (
        unauthenticated.post(
            "/api/v1/auth/login",
            json={"email": "z1.receiver@example.invalid", "password": password},
            headers={"X-Requested-With": ""},
        ).status_code
        == 403
    )
    with db.connect() as c:
        assert (
            c.execute(text("SELECT name FROM users WHERE user_id=102")).scalar_one()
            == "Demo Z1 Receiver"
        )
        assert c.execute(text("SELECT count(*) FROM trust_ledger")).scalar_one() == 21


def test_expired_session_and_inactive_user_are_denied(identity):
    db, password, make, _ = identity
    client = make()
    sign_in(client, password)
    with db.begin() as c:
        c.execute(
            text(
                "UPDATE sessions SET created_at=clock_timestamp()-interval '2 hours',"
                "expires_at=clock_timestamp()-interval '1 second' WHERE user_id=102"
            )
        )
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/session").json() == {"data": None}
    sign_in(client, password)
    with db.begin() as c:
        c.execute(text("UPDATE users SET active=false WHERE user_id=102"))
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/session").json() == {"data": None}
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "z1.receiver@example.invalid", "password": password},
        ).status_code
        == 401
    )


def test_unknown_wrong_disabled_credentials_share_safe_error_and_rate_limit(identity):
    _, password, make, _ = identity
    client = make()
    unknown = client.post(
        "/api/v1/auth/login", json={"email": "unknown@example.invalid", "password": password}
    )
    wrong = client.post(
        "/api/v1/auth/login",
        json={"email": "z1.receiver@example.invalid", "password": password + "wrong"},
    )
    disabled = client.post(
        "/api/v1/auth/login", json={"email": "z1.volunteer@example.invalid", "password": password}
    )
    assert unknown.status_code == wrong.status_code == disabled.status_code == 401
    assert unknown.json()["error"] == wrong.json()["error"] == disabled.json()["error"]
    for _ in range(7):
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"email": "unknown@example.invalid", "password": password},
            ).status_code
            == 401
        )
    limited = client.post(
        "/api/v1/auth/login", json={"email": "unknown@example.invalid", "password": password}
    )
    assert limited.status_code == 429 and limited.headers["retry-after"] == "60"


def test_admin_verification_scope_requested_roles_revocation_and_private_reason(identity):
    db, password, make, _ = identity
    admin = make()
    sign_in(admin, password, "z1.admin@example.invalid")
    pending = admin.get("/api/v1/admin/users", params={"verified": False, "limit": 1})
    assert pending.status_code == 200, pending.text
    assert pending.json()["data"][0]["user_id"] == 106
    reason = "Synthetic review detail kept out of trust payloads"
    result = admin.post(
        "/api/v1/admin/users/106/verify",
        json={"roles": ["Receiver"], "verified": True, "reason": reason},
    )
    assert result.status_code == 200, result.text
    assert result.json()["data"]["capabilities"] == ["Receiver"]
    for uid in [202, 999999]:
        assert (
            admin.post(
                f"/api/v1/admin/users/{uid}/verify",
                json={"roles": ["Receiver"], "verified": True, "reason": reason},
            ).status_code
            == 404
        )
    assert admin.get("/api/v1/admin/users", params={"zone_id": 2}).status_code == 404
    assert (
        admin.post(
            "/api/v1/admin/users/106/verify",
            json={"roles": ["Admin"], "verified": True, "reason": reason},
        ).status_code
        == 422
    )
    assert (
        admin.post(
            "/api/v1/admin/users/106/verify",
            json={"roles": ["Donor"], "verified": True, "reason": reason},
        ).status_code
        == 422
    )
    receiver = make()
    sign_in(receiver, password, "pending.receiver@example.invalid")
    assert receiver.get("/api/v1/auth/me").json()["data"]["user"]["capabilities"] == ["Receiver"]
    assert (
        receiver.post(
            "/api/v1/admin/users/106/verify",
            json={"roles": ["Receiver"], "verified": True, "reason": reason},
        ).status_code
        == 403
    )
    assert (
        admin.post(
            "/api/v1/admin/users/106/verify",
            json={"roles": [], "verified": False, "reason": reason},
        ).status_code
        == 200
    )
    assert receiver.get("/api/v1/auth/me").json()["data"]["user"]["capabilities"] == []
    with db.connect() as c:
        assert c.execute(text("SELECT count(*) FROM verification_reviews")).scalar_one() == 2
        assert all(
            reason not in str(row["payload"])
            for row in c.execute(text("SELECT payload FROM trust_ledger")).mappings()
        )
        verify(c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings())


def test_profile_only_self_mutable_fields_and_no_pii_in_ledger(identity):
    db, password, make, _ = identity
    client = make()
    sign_in(client, password)
    result = client.patch(
        "/api/v1/auth/me", json={"name": "Synthetic updated receiver", "capacity_kg": "18.50"}
    )
    assert result.status_code == 200, result.text
    assert result.json()["data"]["capacity_kg"] == "18.50"
    for change in [
        {"zone_id": 2},
        {"roles": ["Admin"]},
        {"verified_status": True},
        {"name": None},
        {},
        {"phone": "+12025550101"},
    ]:
        expected = 409 if "phone" in change else 422
        assert client.patch("/api/v1/auth/me", json=change).status_code == expected
    with db.connect() as c:
        payload = c.execute(
            text("SELECT payload FROM trust_ledger WHERE action_type='identity.profile_updated'")
        ).scalar_one()
        assert payload == {"changed_fields": ["capacity_kg", "name"]}
        assert c.execute(text("SELECT zone_id FROM users WHERE user_id=102")).scalar_one() == 1


def test_actual_login_roles_pool_isolation_and_no_auth_escalation(identity):
    db, password, make, settings = identity
    first = make()
    second = make()
    sign_in(first, password)
    sign_in(second, password, "z2.receiver@example.invalid")
    for _ in range(3):
        assert first.get("/api/v1/auth/me").json()["data"]["user"]["user_id"] == 102
        assert second.get("/api/v1/auth/me").json()["data"]["user"]["user_id"] == 202
    access = Access(settings)
    try:
        with access.transaction("runtime", digest(first.cookies.get(SESSION_COOKIE))) as c:
            assert c.execute(text("SELECT session_user")).scalar_one() == "dbthon_test_runtime"
            assert set(c.execute(text("SELECT DISTINCT zone_id FROM food_listings")).scalars()) == {
                1
            }
        for sql in [
            "SET ROLE dbthon_auth",
            "SELECT * FROM sessions",
            "SELECT password_hash FROM users",
            "SELECT * FROM dbthon_auth_credentials('z1.receiver@example.invalid')",
        ]:
            with pytest.raises(DBAPIError), access.transaction("runtime") as c:
                c.execute(text(sql))
        with access.transaction("runtime") as c:
            assert c.execute(text("SELECT dbthon_actor_id()")).scalar_one() is None
            assert c.execute(text("SELECT count(*) FROM users")).scalar_one() == 0
        bad = settings.model_copy(
            update={"app_database_url": SecretStr(db.url.render_as_string(hide_password=False))}
        )
        unsafe = Access(bad)
        with pytest.raises(DomainError), unsafe.transaction("runtime"):
            pass
        unsafe.close()
    finally:
        access.close()


def test_secure_production_cookie_and_rotation(identity, monkeypatch):
    _, password, make, settings = identity
    # This local disposable Postgres service has no TLS listener. Keep this test
    # focused on HTTPS cookies; production database TLS is checked separately.
    driver_url = Settings._driver_url
    monkeypatch.setattr(
        Settings,
        "_driver_url",
        lambda self, url: driver_url(self, url).update_query_dict({"sslmode": "disable"}),
    )
    production = settings.model_copy(
        update={"app_env": "production", "allowed_origins": ["https://app.example.com"]}
    )
    client = make(production, base_url="https://app.example.com")
    client.headers["Origin"] = "https://app.example.com"
    result = sign_in(client, password)
    assert "Secure" in result.headers["set-cookie"]
    assert "SameSite=none" in result.headers["set-cookie"]
    old = client.cookies.get(SESSION_COOKIE)
    sign_in(client, password)
    assert client.cookies.get(SESSION_COOKIE) != old
    old_client = make(production, base_url="https://app.example.com")
    old_client.cookies.set(SESSION_COOKIE, old, path="/api/v1")
    assert old_client.get("/api/v1/auth/me").status_code == 401


def test_public_zone_pagination_and_full_readiness(identity):
    _, _, make, _ = identity
    client = make()
    result = client.get("/api/v1/zones", params={"limit": 2})
    assert result.status_code == 200, result.text
    assert [zone["zone_id"] for zone in result.json()["data"]] == [1, 2]
    assert result.json()["meta"]["next_cursor"] == 2
    assert client.get("/api/v1/health/ready").status_code == 200
    assert (
        client.get("/api/v1/zones", params={"city": "Demo Chennai"}).json()["data"][0]["zone_id"]
        == 4
    )


def test_session_count_bound_and_admin_unfiltered_pagination(identity):
    db, password, make, _ = identity
    clients = [make() for _ in range(6)]
    for client in clients:
        sign_in(client, password)
    assert clients[0].get("/api/v1/auth/me").status_code == 401
    assert all(client.get("/api/v1/auth/me").status_code == 200 for client in clients[1:])
    with db.connect() as c:
        assert (
            c.execute(
                text(
                    "SELECT count(*) FROM sessions WHERE user_id=102 "
                    "AND revoked_at IS NULL AND expires_at>clock_timestamp()"
                )
            ).scalar_one()
            == 5
        )
    admin = make()
    sign_in(admin, password, "z1.admin@example.invalid")
    first = admin.get("/api/v1/admin/users", params={"limit": 3})
    assert first.status_code == 200, first.text
    next_cursor = first.json()["meta"]["next_cursor"]
    second = admin.get("/api/v1/admin/users", params={"cursor": next_cursor})
    assert second.status_code == 200
    assert all(user["zone_id"] == 1 for user in second.json()["data"])
    assert not set(user["user_id"] for user in first.json()["data"]) & set(
        user["user_id"] for user in second.json()["data"]
    )


def test_local_demo_password_command_audits_and_revokes_sessions(identity, monkeypatch):
    import getpass
    import runpy
    import sys

    db, password, make, _ = identity
    client = make()
    sign_in(client, password, "z1.admin@example.invalid")
    replacement = secrets.token_urlsafe(24)
    monkeypatch.setenv("DATABASE_URL", db.url.render_as_string(hide_password=False))
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setattr(getpass, "getpass", lambda prompt: replacement)
    monkeypatch.setattr(sys, "argv", ["demo_password.py", "--user", "104"])
    runpy.run_path(str(ROOT / "scripts/demo_password.py"), run_name="__main__")
    assert client.get("/api/v1/auth/me").status_code == 401
    sign_in(client, replacement, "z1.admin@example.invalid")
    with db.connect() as c:
        assert c.execute(
            text("SELECT payload FROM trust_ledger WHERE action_type='fixture.password_set'")
        ).scalar_one() == {"synthetic": True}
        verify(c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings())


def test_login_upgrades_old_argon_parameters(identity):
    from argon2 import PasswordHasher

    db, password, make, _ = identity
    old = PasswordHasher(time_cost=1, memory_cost=8192, parallelism=1).hash(password)
    with db.begin() as c:
        c.execute(text("UPDATE users SET password_hash=:old WHERE user_id=102"), {"old": old})
    sign_in(make(), password)
    with db.connect() as c:
        current = c.execute(text("SELECT password_hash FROM users WHERE user_id=102")).scalar_one()
        assert current != old and HASHER.verify(current, password)
        assert not HASHER.check_needs_rehash(current)


def test_multi_role_registration_and_replacing_approved_subset(identity):
    db, password, make, _ = identity
    newcomer = make()
    registered = newcomer.post(
        "/api/v1/auth/register",
        json=registration(password, roles=["Donor", "Receiver", "Volunteer"]),
    )
    assert registered.status_code == 201, registered.text
    uid = registered.json()["data"]["user_id"]
    sign_in(newcomer, password, "new.receiver@example.com")
    admin = make()
    sign_in(admin, password, "z1.admin@example.invalid")
    first = admin.post(
        f"/api/v1/admin/users/{uid}/verify",
        json={
            "roles": ["Donor", "Receiver"],
            "verified": True,
            "reason": "Synthetic multiple-role review",
        },
    )
    assert first.status_code == 200, first.text
    assert newcomer.get("/api/v1/auth/me").json()["data"]["user"]["capabilities"] == [
        "Donor",
        "Receiver",
    ]
    second = admin.post(
        f"/api/v1/admin/users/{uid}/verify",
        json={"roles": ["Volunteer"], "verified": True, "reason": "Synthetic replacement review"},
    )
    assert second.status_code == 200, second.text
    assert newcomer.get("/api/v1/auth/me").json()["data"]["user"]["capabilities"] == ["Volunteer"]
    with db.connect() as c:
        verify(c.execute(text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")).mappings())
