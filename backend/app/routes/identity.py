from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response
from sqlalchemy import Connection, text

from app.core.access import Access
from app.core.config import Settings
from app.core.errors import DomainError
from app.identity import service
from app.identity.models import (
    AccountDeletion,
    AdminGrant,
    Login,
    NotificationPreferences,
    NotificationPreferencesData,
    NotificationPreferencesResponse,
    PageMeta,
    ProfileUpdate,
    Registration,
    RoleData,
    SessionData,
    SessionResponse,
    SessionSnapshotResponse,
    UserData,
    UserResponse,
    UsersResponse,
    Verification,
    ZoneData,
    ZoneSelection,
    ZonesResponse,
)
from app.identity.security import (
    HASHER,
    SESSION_COOKIE,
    csrf_token,
    digest,
    guard_write,
    session_token,
)
from app.workflows.alerts import channels

router = APIRouter(tags=["Identity"])


def notification_preferences_data(c: Connection, settings: Settings) -> NotificationPreferencesData:
    row = (
        c.execute(
            text("""
      SELECT sms_enabled,push_enabled,whatsapp_enabled FROM notification_preferences
      WHERE user_id=dbthon_actor_id()
    """)
        )
        .mappings()
        .first()
    )
    return NotificationPreferencesData(
        sms_enabled=bool(row["sms_enabled"]) if row else False,
        push_enabled=bool(row["push_enabled"]) if row else False,
        sms_configured="SMS" in channels(settings, require_credential=False),
        whatsapp_enabled=bool(row["whatsapp_enabled"]) if row else False,
        whatsapp_configured="WhatsApp" in channels(settings, require_credential=False),
        push_configured=False,
    )


@router.get("/settings/notifications", response_model=NotificationPreferencesResponse)
def get_notification_preferences(request: Request) -> NotificationPreferencesResponse:
    with context(request) as c:
        return NotificationPreferencesResponse(
            data=notification_preferences_data(c, request.app.state.settings)
        )


@router.patch("/settings/notifications", response_model=NotificationPreferencesResponse)
def save_notification_preferences(
    body: NotificationPreferences, request: Request
) -> NotificationPreferencesResponse:
    with context(request, write=True) as c:
        c.execute(
            text("SELECT dbthon_save_external_preferences(:sms,:push,:whatsapp)"),
            {
                "whatsapp": body.whatsapp_enabled,
                "sms": body.sms_enabled,
                "push": body.push_enabled,
            },
        )
        return NotificationPreferencesResponse(
            data=notification_preferences_data(c, request.app.state.settings)
        )


@contextmanager
def context(request: Request, write: bool = False) -> Iterator[Connection]:
    settings: Settings = request.app.state.settings
    if write:
        guard_write(request, settings)
    token = session_token(request)
    access: Access = request.app.state.access
    supplied_csrf = request.headers.get("X-CSRF-Token", "")
    with access.transaction(
        "runtime", digest(token), digest(supplied_csrf) if supplied_csrf else ""
    ) as c:
        c.execute(text("SELECT dbthon_require_actor(:write)"), {"write": write})
        yield c


@router.get("/zones", response_model=ZonesResponse)
def zones(
    request: Request,
    city: str | None = None,
    cursor: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ZonesResponse:
    access: Access = request.app.state.access
    with access.transaction("auth") as c:
        rows = (
            c.execute(
                text(
                    "SELECT zone_id,zone_name,city FROM zones WHERE zone_id>:cursor "
                    "AND (CAST(:city AS text) IS NULL OR city=:city) ORDER BY zone_id LIMIT :limit"
                ),
                {"cursor": cursor, "city": city, "limit": limit + 1},
            )
            .mappings()
            .all()
        )
    return ZonesResponse(
        data=[ZoneData(**row) for row in rows[:limit]],
        meta=PageMeta(next_cursor=rows[limit - 1]["zone_id"] if len(rows) > limit else None),
    )


@router.post("/auth/register", response_model=UserResponse, status_code=201)
def register(body: Registration, request: Request) -> UserResponse:
    guard_write(request, request.app.state.settings)
    access: Access = request.app.state.access
    service.throttle(access, "register", request.client.host if request.client else "unknown")
    hashed = HASHER.hash(body.password.get_secret_value())
    with access.transaction("auth") as c:
        uid = c.execute(
            text("SELECT dbthon_register(CAST(:body AS jsonb),:hashed)"),
            {"body": body.model_dump_json(exclude={"password"}), "hashed": hashed},
        ).scalar_one()
    return UserResponse(
        data=UserData(
            **body.model_dump(exclude={"password", "roles", "capacity_kg"}),
            user_id=uid,
            verified_status=False,
            active=True,
            roles=[RoleData(role=role, approved=False) for role in body.roles],
            capabilities=[],
            capacity_kg=f"{body.capacity_kg:.2f}" if body.capacity_kg is not None else None,
        )
    )


@router.post("/auth/login", response_model=SessionResponse)
def login(body: Login, request: Request, response: Response) -> SessionResponse:
    settings: Settings = request.app.state.settings
    guard_write(request, settings)
    access: Access = request.app.state.access
    service.throttle(
        access, "login", request.client.host if request.client else "unknown", str(body.email)
    )
    token, data = service.login(
        access,
        str(body.email),
        body.password.get_secret_value(),
        request.cookies.get(SESSION_COOKIE),
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=43200,
        httponly=True,
        secure=settings.app_env == "production",
        samesite=settings.session_same_site if settings.app_env == "production" else "lax",
        path="/api/v1",
    )
    return SessionResponse(data=data)


@router.get("/auth/me", response_model=SessionResponse)
def me(request: Request) -> SessionResponse:
    with context(request) as c:
        uid = c.execute(text("SELECT dbthon_actor_id()")).scalar_one()
        data = SessionData(
            user=service.user_data(c, uid), csrf_token=csrf_token(session_token(request))
        )
    return SessionResponse(data=data)


@router.get("/auth/session", response_model=SessionSnapshotResponse)
def session_snapshot(request: Request) -> SessionSnapshotResponse:
    """Anonymous is a normal UI state; protected endpoints still require an actor."""
    try:
        token = session_token(request)
    except DomainError as error:
        if error.status != 401:
            raise
        return SessionSnapshotResponse(data=None)
    access: Access = request.app.state.access
    with access.transaction("runtime", digest(token)) as c:
        uid = c.execute(text("SELECT dbthon_actor_id()")).scalar_one()
        if uid is None:
            return SessionSnapshotResponse(data=None)
        return SessionSnapshotResponse(
            data=SessionData(user=service.user_data(c, uid), csrf_token=csrf_token(token))
        )


@router.patch("/auth/me", response_model=UserResponse)
def update_profile(body: ProfileUpdate, request: Request) -> UserResponse:
    with context(request, write=True) as c:
        uid = c.execute(
            text("SELECT dbthon_update_profile(CAST(:body AS jsonb))"),
            {"body": body.model_dump_json(exclude_unset=True)},
        ).scalar_one()
        data = service.user_data(c, uid)
    return UserResponse(data=data)


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response) -> None:
    with context(request, write=True) as c:
        c.execute(text("SELECT dbthon_revoke_session()"))
    response.delete_cookie(
        SESSION_COOKIE,
        path="/api/v1",
        secure=request.app.state.settings.app_env == "production",
        httponly=True,
        samesite=request.app.state.settings.session_same_site
        if request.app.state.settings.app_env == "production"
        else "lax",
    )


@router.post("/account/confirm-zone", response_model=UserResponse)
def confirm_zone(body: ZoneSelection, request: Request) -> UserResponse:
    with context(request, write=True) as c:
        uid = c.execute(
            text("SELECT dbthon_confirm_zone(:zone)"), {"zone": body.zone_id}
        ).scalar_one()
        return UserResponse(data=service.user_data(c, uid))


@router.get("/admin/users", response_model=UsersResponse, tags=["Administration"])
def admin_users(
    request: Request,
    verified: bool | None = None,
    zone_id: Annotated[int | None, Query(gt=0)] = None,
    cursor: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> UsersResponse:
    with context(request) as c:
        if not c.execute(text("SELECT dbthon_has_role('Admin')")).scalar_one():
            raise DomainError("ADMIN_REQUIRED", 403, "Zone administrator access is required.")
        global_admin = c.execute(
            text(
                "SELECT email='z1.admin@example.invalid' FROM users WHERE user_id=dbthon_actor_id()"
            )
        ).scalar_one()
        if (
            zone_id is not None
            and zone_id != c.execute(text("SELECT dbthon_actor_zone()")).scalar_one()
            and not global_admin
        ):
            raise DomainError("NOT_FOUND", 404, "The requested resource was not found.")
        ids = (
            c.execute(
                text(
                    "SELECT user_id FROM users WHERE user_id>:cursor AND deleted_at IS NULL "
                    "AND (CAST(:zone_id AS bigint) IS NULL OR zone_id=:zone_id) "
                    "AND (CAST(:verified AS boolean) IS NULL OR verified_status=:verified) "
                    "ORDER BY user_id LIMIT :limit"
                ),
                {
                    "cursor": cursor,
                    "zone_id": zone_id,
                    "verified": verified,
                    "limit": limit + 1,
                },
            )
            .scalars()
            .all()
        )
        data = [service.user_data(c, uid) for uid in ids[:limit]]
    return UsersResponse(
        data=data, meta=PageMeta(next_cursor=ids[limit - 1] if len(ids) > limit else None)
    )


@router.post("/admin/users/{user_id}/verify", response_model=UserResponse, tags=["Administration"])
def verify_user(user_id: int, body: Verification, request: Request) -> UserResponse:
    with context(request, write=True) as c:
        uid = c.execute(
            text("SELECT dbthon_verify_user(:uid,CAST(:roles AS text[]),:verified,:reason)"),
            {"uid": user_id, "roles": body.roles, "verified": body.verified, "reason": body.reason},
        ).scalar_one()
        data = service.user_data(c, uid)
    return UserResponse(data=data)


@router.post("/admin/users/{user_id}/admin", response_model=UserResponse, tags=["Administration"])
def grant_admin(user_id: int, body: AdminGrant, request: Request) -> UserResponse:
    with context(request, write=True) as c:
        uid = c.execute(
            text("SELECT dbthon_grant_admin(:uid,:reason)"),
            {
                "uid": user_id,
                "reason": body.reason,
            },
        ).scalar_one()
        return UserResponse(data=service.user_data(c, uid))


@router.delete("/auth/me", status_code=204)
def delete_my_account(body: AccountDeletion, request: Request, response: Response) -> None:
    with context(request, write=True) as c:
        c.execute(
            text("SELECT dbthon_delete_account(dbthon_actor_id(),:email)"),
            {"email": body.confirmation_email},
        )
    settings = request.app.state.settings
    response.delete_cookie(
        SESSION_COOKIE,
        path="/api/v1",
        secure=settings.app_env == "production",
        httponly=True,
        samesite=settings.session_same_site if settings.app_env == "production" else "lax",
    )


@router.delete("/admin/users/{user_id}", status_code=204, tags=["Administration"])
def delete_member(user_id: int, body: AccountDeletion, request: Request) -> None:
    with context(request, write=True) as c:
        c.execute(
            text("SELECT dbthon_delete_account(:uid,:email)"),
            {"uid": user_id, "email": body.confirmation_email},
        )
