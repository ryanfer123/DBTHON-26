"""Private operator setup for an existing, seeded administrator; no public route."""

import hashlib
import json
import re

from sqlalchemy import Connection, text

from app.seed import FIXTURE


def configure_fixture_admin(c: Connection, email: str, password_hash: str) -> dict[str, object]:
    if not re.fullmatch(
        r"\$argon2id\$v=19\$m=65536,t=3,p=4\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}",
        password_hash,
    ):
        raise ValueError("Supply an Argon2id hash generated with the application password policy")
    raw = FIXTURE.read_bytes()
    fixtures = json.loads(raw)
    candidates = [u for u in fixtures["users"] if u["email"] == email and "Admin" in u["roles"]]
    if len(candidates) != 1:
        raise ValueError("Only an existing synthetic fixture administrator can be configured")
    target = candidates[0]
    installed = c.execute(
        text("SELECT fixture_hash FROM seed_runs WHERE seed_name='demo-v1'")
    ).scalar_one_or_none()
    if installed != hashlib.sha256(raw).hexdigest():
        raise ValueError("The expected synthetic fixture must already be installed")
    user = (
        c.execute(
            text(
                "SELECT user_id,zone_id,email,active,verified_status FROM users "
                "WHERE user_id=:uid FOR UPDATE"
            ),
            {"uid": target["user_id"]},
        )
        .mappings()
        .one_or_none()
    )
    approved = c.execute(
        text(
            "SELECT EXISTS(SELECT FROM user_roles WHERE user_id=:uid "
            "AND role='Admin' AND approved_at IS NOT NULL)"
        ),
        {"uid": target["user_id"]},
    ).scalar_one()
    if (
        user is None
        or user["email"] != email
        or user["zone_id"] != target["zone_id"]
        or not user["active"]
        or not user["verified_status"]
        or not approved
    ):
        raise ValueError("The selected fixture administrator is missing or no longer eligible")
    c.execute(
        text("UPDATE users SET password_hash=:hashed WHERE user_id=:uid"),
        {"hashed": password_hash, "uid": user["user_id"]},
    )
    c.execute(
        text(
            "UPDATE sessions SET revoked_at=clock_timestamp() "
            "WHERE user_id=:uid AND revoked_at IS NULL"
        ),
        {"uid": user["user_id"]},
    )
    c.execute(
        text(
            "SELECT dbthon_record_event(ARRAY[CAST(:uid AS bigint)],'fixture.password_set',"
            "'users',:uid,NULL,jsonb_build_object('synthetic',true,'operator_initialization',true))"
        ),
        {"uid": user["user_id"]},
    )
    return {"admin_login_enabled": True, "user_id": user["user_id"], "zone_id": user["zone_id"]}
