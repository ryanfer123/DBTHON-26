# Developer setup and working commands

P01 is implemented. Prerequisites: Python 3.13 (selected in apps/api/.python-version),
uv, Node 22.13+ and npm, Docker Engine/Desktop with Compose v2.

## Start locally

```sh
make setup
make install
make db-up
make dev
```

`make setup` creates an ignored mode-0600 `.env` with a random database password,
without printing it. Existing `.env` is preserved. `make install` uses committed
uv.lock and package-lock.json. `make dev` starts both apps and stops them on Ctrl+C.
The frontend is `http://127.0.0.1:5173`; API docs are
`http://127.0.0.1:8000/api/docs`. Vite proxies `/api` to port 8000.

To start each process independently use `make api-dev` and `make web-dev`.
`make db-down` stops PostgreSQL without deleting its named volume. Changing local
credentials does not update an already initialized volume; preserve the existing
configuration. Compose only installs PostgreSQL/PostGIS, not the application schema.
The Compose bootstrap owner is not the future restricted API runtime identity.

## Verification

```sh
make check lint typecheck test build
make e2e
make openapi
```

Backend checks: Ruff, strict mypy, six pytest tests. Frontend checks: ESLint,
TypeScript, four Vitest tests, production build. Browser tests exercise the real
API and DB readiness, role selection/keyboard/refresh, failure/retry and no horizontal
overflow on desktop/mobile. They require a running Docker database and installed
Google Chrome locally; Playwright starts API/web if ports are free. CI installs
Playwright Chromium and runs a disposable PostGIS service.

The Browser plugin was not available in this session, so verification used Playwright
with installed Chrome. Native concept viewport: 1505x1045; mobile: 390x844. Current
screen is a public introduction; auth/listing/delivery workflows are not implemented.

`docs/openapi.json` describes only implemented routes. `make openapi` regenerates
it; `uv run --project apps/api python scripts/export_openapi.py --check` detects drift.
`GET /api/v1/health/live` returns 200 when the process is alive.
`GET /api/v1/health/ready` requires a real PostgreSQL/PostGIS response and returns
503 with a safe error and request ID if configuration/dependency is unavailable.

## Commands still to add in P02+

- Alembic migrations and `alembic upgrade head`.
- A fixture importer supporting fixed UTC anchors and `--anchor-now`.
- A notification/expiry worker invocation.
- PostgreSQL domain, concurrency, RLS and ledger test commands.

Use dedicated disposable test resources; never run resets against a deployment DB.
The existing fixture is not automatically imported, and no source requirement is
considered fulfilled by the welcome screen alone.

## Platform notes

The upstream PostGIS image advertises amd64 and the PostgreSQL 17 volume path
`/var/lib/postgresql/data`; Compose explicitly requests amd64 for Apple Silicon
emulation. Local execution verified PostgreSQL 17.5 and PostGIS 3.5.
If the host Git launcher is blocked by an Xcode-license check, the direct installed
`/Library/Developer/CommandLineTools/usr/bin/git` worked during initialization.

References: [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/),
[Vite guide](https://vite.dev/guide/), [PostGIS image](https://github.com/postgis/docker-postgis).
