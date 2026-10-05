# Second Table API

P01 implements public community descriptions and liveness/readiness, request IDs,
PostgreSQL/PostGIS connectivity, pytest, Ruff and strict mypy. Dependencies are
locked in uv.lock. Run `make api-dev` from the repository root, or from here:

```sh
uv sync --locked
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
uv run pytest
uv run ruff check .
uv run mypy app
```

Root `.env` configures connectivity. Run `make migrate` from the repo root to apply
revisions 0001/0002, then `make db-access` for separate restricted pools.
Use `make seed ANCHOR=<UTC ISO timestamp>` to import synthetic data,
`make ledger-verify` to check hashes, and `make db-test` for real PostgreSQL tests.
Registration/session/profile/admin APIs are implemented, backed by guarded SQL
routines. Seeded account logins are initially disabled; use the interactive
`scripts/demo_password.py` setup described in [identity](../../docs/IDENTITY.md).
Listing/delivery APIs and account screens remain unfinished.
Target [architecture](../../docs/ARCHITECTURE.md), [database](../../docs/DATABASE.md)
and [API](../../docs/API.md) remain authoritative for unfinished domain features.
Use real PostgreSQL for integration tests; SQLite is not supported.
