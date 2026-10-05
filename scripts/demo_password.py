"""Enable a synthetic fixture account with a locally entered password."""

import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api"))

from sqlalchemy import create_engine, text

from app.core.config import Settings
from app.identity.security import HASHER
from app.seed import FIXTURE


def main() -> None:
    import json

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user", type=int, required=True)
    args = parser.parse_args()
    settings = Settings()
    if settings.app_env == "production" or args.user not in {
        user["user_id"] for user in json.loads(FIXTURE.read_text())["users"]
    }:
        parser.error("Only local synthetic fixture accounts can be enabled")
    password = getpass.getpass("New local demo password (12-128 characters): ")
    if not 12 <= len(password) <= 128 or password != getpass.getpass("Confirm password: "):
        parser.error("Passwords must match and meet the length requirement")
    url = settings.connection_url()
    if url is None:
        parser.error("Configure the local database first")
    with create_engine(url, hide_parameters=True).begin() as c:
        if not c.execute(text("SELECT 1 FROM seed_runs WHERE seed_name='demo-v1'")).first():
            parser.error("Import the synthetic fixture first")
        changed = c.execute(
            text("UPDATE users SET password_hash=:hashed WHERE user_id=:uid"),
            {"hashed": HASHER.hash(password), "uid": args.user},
        )
        if changed.rowcount != 1:
            parser.error("The selected fixture account is missing")
        c.execute(
            text(
                "UPDATE sessions SET revoked_at=clock_timestamp() "
                "WHERE user_id=:uid AND revoked_at IS NULL"
            ),
            {"uid": args.user},
        )
        c.execute(
            text(
                "SELECT dbthon_record_event(ARRAY[CAST(:uid AS bigint)],'fixture.password_set',"
                "'users',:uid,NULL,jsonb_build_object('synthetic',true))"
            ),
            {"uid": args.user},
        )
    print("Local fixture login enabled; password was not printed.")


if __name__ == "__main__":
    main()
