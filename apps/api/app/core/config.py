from pathlib import Path
from typing import Literal, Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL, make_url

ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    static_dist: Path | None = None
    session_same_site: Literal["lax", "none"] = "none"
    database_url: SecretStr | None = None
    app_database_url: SecretStr | None = None
    auth_database_url: SecretStr | None = None
    worker_database_url: SecretStr | None = None
    worker_interval_seconds: int = Field(default=5, ge=1, le=60)
    allowed_origins: list[str] = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ]
    postgres_db: str = "dbthon"
    postgres_user: str = "dbthon"
    postgres_password: SecretStr | None = None
    postgres_host: str = "127.0.0.1"
    postgres_port: int = Field(default=5432, ge=1, le=65535)
    db_auth_user: str = "dbthon_identity"
    db_auth_password: SecretStr | None = None
    db_runtime_user: str = "dbthon_app"
    db_runtime_password: SecretStr | None = None
    db_worker_user: str = "dbthon_jobs"
    db_worker_password: SecretStr | None = None

    @field_validator("allowed_origins")
    @classmethod
    def validate_origins(cls, origins: list[str]) -> list[str]:
        from urllib.parse import urlsplit

        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or (
                    parsed.path
                    or parsed.query
                    or parsed.fragment
                    or parsed.username
                    or parsed.password
                )
            ):
                raise ValueError("Origins must be explicit HTTP(S) origins without paths")
        return origins

    def restricted_url(self, purpose: str) -> URL | None:
        value = {
            "auth": self.auth_database_url,
            "runtime": self.app_database_url,
            "worker": self.worker_database_url,
        }.get(purpose)
        if value is not None and value.get_secret_value():
            url = make_url(value.get_secret_value())
            if url.get_backend_name() != "postgresql":
                raise ValueError("The application requires PostgreSQL.")
            return self._driver_url(url)
        user, password = {
            "auth": (self.db_auth_user, self.db_auth_password),
            "runtime": (self.db_runtime_user, self.db_runtime_password),
            "worker": (self.db_worker_user, self.db_worker_password),
        }.get(purpose, ("", None))
        if not self.postgres_host or not password or not password.get_secret_value():
            return None
        return self._driver_url(
            URL.create(
                "postgresql",
                username=user,
                password=password.get_secret_value(),
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            )
        )

    def _driver_url(self, url: URL) -> URL:
        url = url.set(drivername="postgresql+psycopg")
        if self.app_env == "production":
            url = url.update_query_dict({"sslmode": "require"})
        return url

    @model_validator(mode="after")
    def production_origins(self) -> Self:
        if self.app_env == "production" and any(
            not origin.startswith("https://") for origin in self.allowed_origins
        ):
            raise ValueError("Production origins must use HTTPS")
        return self

    def connection_url(self) -> URL | None:
        if self.database_url and self.database_url.get_secret_value():
            url = make_url(self.database_url.get_secret_value())
            if url.get_backend_name() != "postgresql":
                raise ValueError("The application requires PostgreSQL.")
            return self._driver_url(url)
        if not self.postgres_password or not self.postgres_password.get_secret_value():
            return None
        return self._driver_url(
            URL.create(
                "postgresql",
                username=self.postgres_user,
                password=self.postgres_password.get_secret_value(),
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            )
        )
