"""Separate restricted pools, with transaction-local roles and session context."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Literal

from sqlalchemy import Connection, Engine, create_engine, text

from app.core.config import Settings
from app.core.errors import DomainError

Purpose = Literal["auth", "runtime", "worker"]


class Access:
    def __init__(self, settings: Settings):
        self.engines: dict[Purpose, Engine | None] = {}
        for purpose in ("auth", "runtime", "worker"):
            url = settings.restricted_url(purpose)
            self.engines[purpose] = (
                create_engine(
                    url,
                    hide_parameters=True,
                    pool_pre_ping=True,
                    pool_size=4,
                    max_overflow=2,
                    pool_timeout=3,
                    connect_args={
                        "connect_timeout": 3,
                        "options": "-c statement_timeout=5000 -c lock_timeout=2000",
                    },
                )
                if url
                else None
            )

    @contextmanager
    def transaction(
        self, purpose: Purpose, session_hash: str = "", csrf_hash: str = ""
    ) -> Iterator[Connection]:
        engine = self.engines[purpose]
        if engine is None:
            raise DomainError(
                "SERVICE_UNAVAILABLE", 503, "Configure restricted database access.", 5
            )
        with engine.begin() as connection:
            # Fail closed even if a URL accidentally points at the bootstrap owner.
            permitted = connection.execute(
                text("""
              SELECT NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb)
                AND NOT EXISTS(SELECT FROM pg_tables WHERE schemaname='public'
                  AND tableowner=session_user)
                AND pg_has_role(session_user,:role,'MEMBER')
                AND NOT pg_has_role(session_user,'dbthon_guard','MEMBER')
                AND NOT EXISTS(SELECT FROM pg_roles forbidden WHERE forbidden.rolname IN
      ('dbthon_auth','dbthon_runtime','dbthon_worker')
                  AND forbidden.rolname<>:role AND
      pg_has_role(session_user,forbidden.oid,'MEMBER'))
              FROM pg_roles r WHERE rolname=session_user
            """),
                {
                    "role": f"dbthon_{purpose}",
                },
            ).scalar_one()
            if not permitted:
                raise DomainError(
                    "SERVICE_UNAVAILABLE", 503, "Restricted database access is required.", 5
                )
            connection.execute(
                text(
                    "SET LOCAL ROLE dbthon_auth"
                    if purpose == "auth"
                    else "SET LOCAL ROLE dbthon_worker"
                    if purpose == "worker"
                    else "SET LOCAL ROLE dbthon_runtime"
                )
            )
            connection.execute(
                text(
                    "SELECT set_config('app.session_hash',:session,true),"
                    "set_config('app.csrf_hash',:csrf,true)"
                ),
                {"session": session_hash, "csrf": csrf_hash},
            )
            yield connection

    def close(self) -> None:
        for engine in self.engines.values():
            if engine is not None:
                engine.dispose()

    def ready(self) -> bool:
        from sqlalchemy.exc import SQLAlchemyError

        try:
            for purpose in ("auth", "runtime"):
                with self.transaction(purpose) as connection:
                    signature = (
                        "public.dbthon_register(jsonb,text)"
                        if purpose == "auth"
                        else ("public.dbthon_require_actor(boolean)")
                    )
                    if not connection.execute(
                        text("SELECT has_function_privilege(current_user,:signature,'EXECUTE')"),
                        {"signature": signature},
                    ).scalar_one():
                        return False
                    if (
                        purpose == "runtime"
                        and not connection.execute(
                            text(
                                "SELECT has_function_privilege(current_user,"
                                "'public.dbthon_command(text,bigint,bigint,jsonb,text)','EXECUTE')"
                            )
                        ).scalar_one()
                    ):
                        return False
            return True
        except (SQLAlchemyError, DomainError):
            return False
