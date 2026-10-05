"""Provision local auth/runtime logins and save their URLs in ignored mode-0600 .env."""

import os
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api"))

import psycopg
from dotenv import dotenv_values

from app.core.config import ROOT, Settings
from app.core.provision import provision_login


def main() -> None:
    settings = Settings()
    if settings.app_env == "production":
        sys.exit("Local provisioning is disabled in production.")
    path = ROOT / ".env"
    existing = dotenv_values(path) if path.exists() else {}
    if settings.app_database_url and settings.auth_database_url:
        print("Existing restricted connection configuration preserved.")
        return
    owner = settings.connection_url()
    if owner is None:
        sys.exit("Run make setup and make migrate first.")
    values = {}
    try:
        with psycopg.connect(
            owner.set(drivername="postgresql").render_as_string(hide_password=False)
        ) as c:
            for purpose, role, variable in [
                ("runtime", "dbthon_app", "APP_DATABASE_URL"),
                ("auth", "dbthon_identity", "AUTH_DATABASE_URL"),
            ]:
                if existing.get(variable):
                    values[variable] = existing[variable]
                    continue
                password = secrets.token_urlsafe(36)
                provision_login(c, role, purpose, password)
                values[variable] = owner.set(username=role, password=password).render_as_string(
                    hide_password=False
                )
    except (psycopg.Error, ValueError):
        sys.exit("Restricted-role provisioning failed; verify local migration/bootstrap access.")
    content = path.read_text() if path.exists() else "# Local restricted connection configuration\n"
    for variable, value in values.items():
        if not existing.get(variable):
            content += f'\n{variable}="{value}"\n'
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        output.write(content)
    path.chmod(0o600)
    print("Separate local auth/runtime roles configured; credentials were not printed.")


if __name__ == "__main__":
    main()
