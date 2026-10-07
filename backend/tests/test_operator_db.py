import secrets

import pytest
from sqlalchemy import text

from app.core.operator import configure_fixture_admin
from app.identity.security import HASHER, matches

pytestmark = pytest.mark.database


def test_fixture_admin_enabling_is_audited_and_revokes_sessions(seeded_db):
    password = secrets.token_urlsafe(24)
    hashed = HASHER.hash(password)
    with seeded_db.begin() as c:
        c.execute(
            text(
                "INSERT INTO sessions(session_hash,user_id,expires_at,csrf_hash) "
                "VALUES(:hash,104,clock_timestamp()+interval '1 hour',:csrf)"
            ),
            {"hash": secrets.token_hex(32), "csrf": secrets.token_hex(32)},
        )
        c.execute(text("SET LOCAL ROLE dbthon_guard"))
        result = configure_fixture_admin(c, "z1.admin@example.invalid", hashed)
        assert result == {"admin_login_enabled": True, "user_id": 104, "zone_id": 1}
        assert matches(
            c.execute(text("SELECT password_hash FROM users WHERE user_id=104")).scalar_one(),
            password,
        )
        assert (
            c.execute(
                text("SELECT count(*) FROM sessions WHERE user_id=104 AND revoked_at IS NULL")
            ).scalar_one()
            == 0
        )
        assert (
            c.execute(
                text(
                    "SELECT count(*) FROM trust_ledger WHERE user_id=104 "
                    "AND action_type='fixture.password_set'"
                )
            ).scalar_one()
            == 1
        )


def test_operator_cannot_promote_a_non_admin_fixture(seeded_db):
    with seeded_db.begin() as c:
        c.execute(text("SET LOCAL ROLE dbthon_guard"))
        with pytest.raises(ValueError, match="existing synthetic fixture administrator"):
            configure_fixture_admin(
                c, "z1.donor@example.invalid", HASHER.hash(secrets.token_urlsafe(24))
            )


def test_operator_rejects_plaintext_and_ineligible_admin(seeded_db):
    with seeded_db.begin() as c:
        c.execute(text("SET LOCAL ROLE dbthon_guard"))
        with pytest.raises(ValueError, match="Argon2id"):
            configure_fixture_admin(c, "z1.admin@example.invalid", "not-a-hash")
        c.execute(text("UPDATE users SET active=false WHERE user_id=104"))
        with pytest.raises(ValueError, match="no longer eligible"):
            configure_fixture_admin(
                c, "z1.admin@example.invalid", HASHER.hash(secrets.token_urlsafe(24))
            )
