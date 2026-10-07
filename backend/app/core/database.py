from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings


class Database:
    """Own the connection pool, with a bounded, truthful readiness probe."""

    def __init__(self, settings: Settings):
        runtime_url = settings.restricted_url("runtime")
        self.restricted = runtime_url is not None
        url = runtime_url or settings.connection_url()
        self.engine: Engine | None = (
            create_engine(
                url,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=5,
                pool_timeout=3,
                connect_args={"connect_timeout": 3, "options": "-c statement_timeout=3000"},
                hide_parameters=True,
            )
            if url
            else None
        )

    def ready(self) -> bool:
        if self.engine is None:
            return False
        try:
            with self.engine.begin() as connection:
                if self.restricted:
                    connection.execute(text("SET LOCAL ROLE dbthon_runtime"))
                # Both PostgreSQL and its spatial extension must actually respond.
                return bool(
                    connection.execute(text("SELECT public.PostGIS_Version()")).scalar_one()
                )
        except SQLAlchemyError:
            # Do not expose hostnames, connection strings or driver errors publicly.
            return False

    def close(self) -> None:
        if self.engine is not None:
            self.engine.dispose()
