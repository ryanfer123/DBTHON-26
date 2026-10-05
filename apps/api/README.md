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

Root `.env` configures connectivity; no schema exists until P02.
Target [architecture](../../docs/ARCHITECTURE.md), [database](../../docs/DATABASE.md)
and [API](../../docs/API.md) remain authoritative for unfinished domain features.
Use real PostgreSQL for integration tests; SQLite is not supported.
