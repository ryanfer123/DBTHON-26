from pathlib import Path
from typing import Literal, Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL, make_url

ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    database_url: SecretStr | None = None
    app_database_url: SecretStr | None = None
    auth_database_url: SecretStr | None = None
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
        value = self.auth_database_url if purpose == "auth" else self.app_database_url
        if value is None or not value.get_secret_value():
            return None
        url = make_url(value.get_secret_value())
        if url.get_backend_name() != "postgresql":
            raise ValueError("The application requires PostgreSQL.")
        return url.set(drivername="postgresql+psycopg")

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
            return url.set(drivername="postgresql+psycopg")
        if not self.postgres_password or not self.postgres_password.get_secret_value():
            return None
        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )
