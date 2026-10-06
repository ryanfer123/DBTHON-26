"""Local setup only: create isolated login roles without exposing their passwords."""

import re

from psycopg import Connection, sql


def provision_login(connection: Connection, name: str, purpose: str, password: str) -> None:
    if name not in {
        "dbthon_app",
        "dbthon_identity",
        "dbthon_jobs",
        "dbthon_test_runtime",
        "dbthon_test_auth",
        "dbthon_test_worker",
    } or (
        purpose not in {"auth", "runtime", "worker"}
        or not re.fullmatch(r"[A-Za-z0-9_-]{32,}", password)
    ):
        raise ValueError("Unexpected local provision parameters")
    group = f"dbthon_{purpose}"
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication "
            "FROM pg_roles WHERE rolname=%s",
            (name,),
        )
        existing = cursor.fetchone()
        if existing and any(existing):
            raise ValueError("Existing role has unexpected elevated privileges")
        cursor.execute(
            "SELECT parent.rolname FROM pg_auth_members membership JOIN pg_roles child "
            "ON child.oid=membership.member JOIN pg_roles parent ON parent.oid=membership.roleid "
            "WHERE child.rolname=%s",
            (name,),
        )
        if any(row[0] != group for row in cursor.fetchall()):
            raise ValueError("Existing role has unexpected memberships")
        cursor.execute(
            sql.SQL(
                "ALTER ROLE {} LOGIN NOINHERIT NOCREATEDB NOCREATEROLE PASSWORD {}"
                if existing is not None
                else "CREATE ROLE {} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE "
                "NOREPLICATION NOBYPASSRLS PASSWORD {}"
            ).format(
                sql.Identifier(name),
                sql.Literal(password),
            )
        )
        cursor.execute(
            sql.SQL("GRANT {} TO {} WITH INHERIT FALSE, SET TRUE").format(
                sql.Identifier(group), sql.Identifier(name)
            )
        )
