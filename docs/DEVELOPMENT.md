# Developer setup and working commands

P01-P10 core prototype workflows are implemented. Prerequisites: Python 3.13 (selected in apps/api/.python-version),
uv, Node 22.13+ and npm, Docker Engine/Desktop with Compose v2.

## Start locally

```sh
make setup
make install
make db-up
make migrate
make db-access
make dev
```

`make setup` creates an ignored mode-0600 `.env` with a random database password,
without printing it. Existing `.env` is preserved. `make install` uses committed
uv.lock and package-lock.json. `make dev` starts API, web and expiry/inbox worker and stops all three on Ctrl+C.
The frontend is `http://127.0.0.1:5173`; API docs are
`http://127.0.0.1:8000/api/docs`. Vite proxies `/api` to port 8000.

To start each process independently use `make api-dev`, `make web-dev` and `make worker`.
`make db-down` stops PostgreSQL without deleting its named volume. Changing local
credentials does not update an already initialized volume; preserve the existing
configuration. Compose installs PostgreSQL/PostGIS; `make migrate` applies revisions
0001, 0002 and 0003. `make db-access` creates separate restricted auth/runtime/worker logins and
saves their URLs locally without printing credentials. Existing URLs are preserved.

## Verification

```sh
make check lint typecheck test build
make e2e
make openapi
make db-test
```

Backend checks: Ruff, strict mypy, twelve unit tests and 67 opt-in PostgreSQL checks.
Frontend checks: ESLint, TypeScript, eight Vitest tests and production build.
Desktop/mobile browser checks exercise registration, login/profile/admin review,
food CRUD/claim/cancellation, replacement volunteer attempts, pickup/delivery,
reciprocal ratings, inbox reads, audit history, report CSV, theme persistence,
sharing fallback, FAQ and recoverable errors. Native date controls use full rows on
narrow displays; section navigation alone animates scrolling. They require local PostgreSQL and installed Google Chrome;
CI installs Playwright Chromium and runs a disposable PostGIS service.

`make e2e` starts fresh API/web servers on ports 8001/5174 using
`scripts/browser_test_server.py`. It creates/resets **only dbthon_browser_test**,
migrates/imports synthetic fixtures, and enables synthetic donor/receiver/volunteer/admin fixtures using an ephemeral
in-memory password shared with test workers. It reuses the configured restricted
login memberships, with their connection databases changed to the isolated DB.
`dbthon` and `dbthon_test` are untouched. Do not point another app at the browser DB
while this suite runs. Keep ports 8001/5174 free; tests never reuse another server.
Browser output defaults to `/tmp/dbthon-browser-results`, overridable with
DBTHON_E2E_OUTPUT. Traces are disabled because forms contain test passwords;
screenshots contain only synthetic test contacts and are outside Git.

The Browser plugin was not available in this session, so verification used Playwright
with installed Chrome. Native concept viewport: 1505x1045; mobile: 390x844. Connected role workflows, expanded homepage and light/dark modes are implemented. Built-in IAB was also checked and reported unavailable.

`docs/openapi.json` describes only implemented routes. `make openapi` regenerates
it; `uv run --project apps/api python scripts/export_openapi.py --check` detects drift.
`GET /api/v1/health/live` returns 200 when the process is alive.
`GET /api/v1/health/ready` requires PostgreSQL/PostGIS and both restricted pools with
their migration-provided routines. It returns
503 with a safe error and request ID if configuration/dependency is unavailable.

## Database commands and test isolation

```sh
make migrate
make seed ANCHOR=2026-10-05T12:00:00Z
make ledger-verify
make db-test
```

Seed supports an explicit UTC anchor, or `make seed` selects the current time.
Retain that timestamp for repeat imports: same anchor/hash is a no-op; a different
anchor fails without changing existing records. Import requires empty application
tables. Synthetic account hashes are initially disabled; enable a local fixture
account using `uv run --project apps/api python scripts/demo_password.py --user 104`.
Password entry is interactive and never stored in Git. See [IDENTITY.md](IDENTITY.md)
for request headers, session/CSRF protocol and admin bootstrap.

`make db-test` creates/uses the fixed `dbthon_test` database, migrates it and clears
only its application tables for each case. It leaves the local demo DB untouched.
`make test` runs unit/web checks and skips PostgreSQL tests unless `--db` is supplied.
`make reset-test` is destructive and refuses database names without a `_test` suffix;
configure POSTGRES_DB=dbthon_test only for a disposable test resource. It downgrades
and upgrades application artifacts, preserving extensions and cluster roles.

HTTP requests use separate restricted auth/runtime pools. A URL pointing at the
owner fails closed; health prefers the restricted runtime URL as well. Bootstrap
credentials are only for migration, synthetic import and local password provisioning.
Do not deploy using the Compose owner account.
The worker uses only WORKER_DATABASE_URL and guarded routines. `make worker` loops
at WORKER_INTERVAL_SECONDS (default 5, bounds 1-60); `python scripts/worker.py --once`
processes one batch. Shutdown/startup preserves pending outbox work. In-app leases
last 30 seconds, retries are exponential with a maximum of five attempts, and missed
collections have a fixed 15-minute grace. Match/claim radius is at most 5 km.
`make feed-plan` captures the actual feed EXPLAIN in dbthon_test without planner hints;
run `make db-test` first to create its synthetic fixture. This is a small-data plan,
not a 10,000-listing performance benchmark. External SMS/push is unconfigured.

Use dedicated disposable test resources; never run resets against a deployment DB.
The existing fixture is not automatically imported, and no source requirement is
considered fulfilled by the welcome screen alone.

## Platform notes

The upstream PostGIS image advertises amd64 and the PostgreSQL 17 volume path
`/var/lib/postgresql/data`; Compose explicitly requests amd64 for Apple Silicon
emulation. Local execution verified PostgreSQL 17.5 and PostGIS 3.5.
If the host Git launcher is blocked by an Xcode-license check, the direct installed
`/Library/Developer/CommandLineTools/usr/bin/git` worked during initialization.
The direct `/Library/Developer/CommandLineTools/usr/bin/make` also worked when the
system Make launcher hit the same license gate.
Restricted environments can set UV_CACHE_DIR and npm's --cache to a writable
temporary directory; lockfiles must remain authoritative.

References: [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/),
[Vite guide](https://vite.dev/guide/), [PostGIS image](https://github.com/postgis/docker-postgis).
