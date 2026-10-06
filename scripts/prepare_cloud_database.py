"""Create the private function-owner role before the first managed-PostgreSQL migration."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api"))

import psycopg
from app.core.config import Settings


def main() -> None:
    owner = Settings().connection_url()
    if owner is None:
        raise SystemExit(
            "Configure the database owner connection for this one-off task."
        )
    try:
        with (
            psycopg.connect(
                owner.set(drivername="postgresql").render_as_string(
                    hide_password=False
                ),
            ) as connection,
            connection.cursor() as cursor,
        ):
            cursor.execute(
                "SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname='dbthon_guard'"
            )
            existing = cursor.fetchone()
            if existing is None:
                cursor.execute("CREATE ROLE dbthon_guard NOLOGIN NOBYPASSRLS")
            elif any(existing):
                raise ValueError(
                    "Existing dbthon_guard must be a non-login, non-elevated role"
                )
            else:
                cursor.execute("ALTER ROLE dbthon_guard NOLOGIN")
            cursor.execute(
                "GRANT dbthon_guard TO CURRENT_USER WITH INHERIT TRUE, SET TRUE"
            )
            cursor.execute("GRANT CREATE ON SCHEMA public TO dbthon_guard")
    except (psycopg.Error, ValueError):
        raise SystemExit(
            "Managed database role preparation failed; verify the owner login and role privileges."
        ) from None
    print("Private non-login database function owner prepared.", flush=True)


if __name__ == "__main__":
    main()
