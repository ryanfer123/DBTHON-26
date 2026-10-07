"""Explain the actual restricted feed query in the fixed disposable backend test DB."""

import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.core.access import Access
from app.core.config import Settings
from app.workflows.service import feed
from pydantic import SecretStr
from sqlalchemy import create_engine, event, text


def main() -> None:
    configured = Settings()
    owner = configured.connection_url()
    runtime = configured.restricted_url("runtime")
    if configured.app_env == "production" or owner is None or runtime is None:
        raise SystemExit("Configure the local prototype first. Production is refused.")
    # This command neither resets nor writes application/domain records.
    name = "dbthon_test"
    engine = create_engine(owner.set(database=name), hide_parameters=True)
    session = secrets.token_hex(32)
    with engine.begin() as c:
        c.execute(
            text(
                "INSERT INTO sessions(session_hash,user_id,expires_at) "
                "VALUES(:session,102,clock_timestamp()+interval '1 minute')"
            ),
            {"session": session},
        )
    access = Access(
        Settings(
            _env_file=None,
            app_env="test",
            app_database_url=SecretStr(
                runtime.set(database=name).render_as_string(hide_password=False)
            ),
        )
    )
    try:
        captured = []
        with access.transaction("runtime", session) as c:

            def capture(_connection, _cursor, statement, parameters, _context, _many):
                if statement.startswith("WITH eligible"):
                    captured.append((statement, parameters))

            event.listen(c, "before_cursor_execute", capture)
            rows, _ = feed(c, None, None, 5000, None, None, 20)
            event.remove(c, "before_cursor_execute", capture)
            query, parameters = captured[0]
            result = (
                c.exec_driver_sql(
                    "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) " + query, parameters
                )
                .scalars()
                .all()
            )
            print(
                "Disposable dbthon_test; runtime role, real RLS and synthetic Receiver 102."
            )
            print(
                f"Returned {len(rows)} live capacity/radius-eligible listings. No planner hints."
            )
            print("\n".join(result))
    finally:
        access.close()
        with engine.begin() as c:
            c.execute(
                text("DELETE FROM sessions WHERE session_hash=:session"),
                {"session": session},
            )
        engine.dispose()


if __name__ == "__main__":
    main()
