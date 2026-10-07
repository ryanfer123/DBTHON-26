"""Local migration, safe disposable reset, synthetic import and ledger verification."""

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app.core.config import ROOT, Settings  # noqa: E402
from app.seed import import_demo  # noqa: E402
from app.trust.verify import verify  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["migrate", "seed", "verify", "reset-test"])
    anchors = parser.add_mutually_exclusive_group()
    anchors.add_argument("--anchor", help="Timezone-aware ISO-8601 UTC import anchor")
    anchors.add_argument("--anchor-now", action="store_true")
    args = parser.parse_args()
    config = Config(str(ROOT / "backend/alembic.ini"))
    url = Settings().connection_url()
    if url is None:
        parser.error("Configure PostgreSQL first with make setup")
    if args.operation == "migrate":
        command.upgrade(config, "head")
        print("Database upgraded to the latest revision.")
        return
    if args.operation == "reset-test":
        if not url.database or not url.database.endswith("_test"):
            parser.error("Reset is restricted to a database whose name ends in _test")
        command.downgrade(config, "base")
        command.upgrade(config, "head")
        print("Disposable test schema reset.")
        return
    with create_engine(url, hide_parameters=True).begin() as connection:
        if args.operation == "seed":
            if not args.anchor and not args.anchor_now:
                parser.error("Seed requires --anchor or --anchor-now")
            anchor = (
                datetime.fromisoformat(args.anchor.replace("Z", "+00:00"))
                if args.anchor
                else (datetime.now(UTC).replace(microsecond=0))
            )
            added = import_demo(connection, anchor)
            print(f"Demo {'imported' if added else 'already imported'} at {anchor.isoformat()}.")
        else:
            count = verify(
                connection.execute(
                    text("SELECT * FROM trust_ledger ORDER BY user_id,sequence")
                ).mappings()
            )
            print(f"Verified {count} ledger entries.")


if __name__ == "__main__":
    main()
