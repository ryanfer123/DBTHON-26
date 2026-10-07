import secrets

from sqlalchemy import Connection, text

from app.core.access import Access
from app.core.errors import DomainError
from app.identity.models import RoleData, SessionData, UserData
from app.identity.security import HASHER, csrf_token, digest, dummy_hash, matches


def user_data(connection: Connection, uid: int) -> UserData:
    row = (
        connection.execute(
            text("""
      SELECT u.user_id,u.zone_id,u.name,u.email,u.phone,u.latitude,u.longitude,
        u.verified_status,u.active,u.zone_review_required,rp.capacity_kg FROM users u
      LEFT JOIN receiver_profiles rp USING(user_id) WHERE u.user_id=:uid
    """),
            {"uid": uid},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise DomainError("NOT_FOUND", 404, "The requested resource was not found.")
    roles = [
        RoleData(role=role["role"], approved=role["approved_at"] is not None)
        for role in connection.execute(
            text("SELECT role,approved_at FROM user_roles WHERE user_id=:uid ORDER BY role"),
            {"uid": uid},
        ).mappings()
    ]
    return UserData(
        **{**row, "capacity_kg": f"{row['capacity_kg']:.2f}" if row["capacity_kg"] else None},
        roles=roles,
        capabilities=[role.role for role in roles if role.approved]
        if row["verified_status"] and row["active"]
        else [],
    )


def throttle(access: Access, purpose: str, remote: str, email: str | None = None) -> None:
    with access.transaction("auth") as connection:
        okay = connection.execute(
            text("SELECT dbthon_auth_throttle(:bucket,:maximum,60)"),
            {
                "bucket": digest(f"{purpose}:ip:{remote}"),
                "maximum": 5 if purpose == "register" else 20,
            },
        ).scalar_one()
        if email is not None:
            okay = (
                connection.execute(
                    text("SELECT dbthon_auth_throttle(:bucket,8,60)"),
                    {"bucket": digest(f"login:email:{email}")},
                ).scalar_one()
                and okay
            )
    # The throttle transaction commits even when the subsequent login fails.
    if not okay:
        raise DomainError("RATE_LIMITED", 429, "Too many attempts. Try again shortly.", 60)


def login(
    access: Access, email: str, password: str, old_token: str | None
) -> tuple[str, SessionData]:
    with access.transaction("auth") as connection:
        credentials = (
            connection.execute(
                text("SELECT * FROM dbthon_auth_credentials(:email)"), {"email": email}
            )
            .mappings()
            .first()
        )
    hashed = (
        credentials["password_hash"]
        if credentials and str(credentials["password_hash"]).startswith("$argon2id$")
        else dummy_hash()
    )
    valid = matches(hashed, password)
    if (
        not valid
        or credentials is None
        or not credentials["active"]
        or hashed != credentials["password_hash"]
    ):
        raise DomainError("INVALID_CREDENTIALS", 401, "Email or password is incorrect.")
    token = secrets.token_urlsafe(32)
    csrf = csrf_token(token)
    with access.transaction("auth") as connection:
        connection.execute(
            text("""
          SELECT dbthon_issue_session(:uid,:expected,:session,:csrf,:old,:replacement)
        """),
            {
                "uid": credentials["user_id"],
                "expected": hashed,
                "session": digest(token),
                "csrf": digest(csrf),
                "old": digest(old_token) if old_token else None,
                "replacement": HASHER.hash(password) if HASHER.check_needs_rehash(hashed) else None,
            },
        )
    with access.transaction("runtime", digest(token)) as connection:
        uid = connection.execute(text("SELECT dbthon_require_actor(false)")).scalar_one()
        return token, SessionData(user=user_data(connection, uid), csrf_token=csrf)
