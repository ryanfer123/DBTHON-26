# DBTHON-26

**Decentralized Surplus Food & Perishable Redistribution Platform**

BCSE302P Database Systems Laboratory project by Ryan Fernandes (24BCE0565) and
Aritra Ghosh (24BCE0598), aligned with T5/T6 Waste & Circular Economy and Healthcare
& Well-being. Verified donors list safe surplus, receivers claim it once, volunteers
collect and deliver it, and administrators inspect accountability and impact.

The public application and database foundation run: FastAPI, React, versioned
PostgreSQL/PostGIS schema, synthetic seeding, guarded claims and independent ledger
verification. **Registration and user-facing redistribution workflows remain unfinished.**
See [current status](docs/STATUS.md).

## Begin implementation

1. Read [AGENTS.md](AGENTS.md).
2. Read the [project brief](docs/PROJECT_BRIEF.md), [requirements](docs/REQUIREMENTS.md),
   and [implementation plan](docs/IMPLEMENTATION_PLAN.md).
3. Use [START_HERE.md](docs/START_HERE.md) as the next coding-session prompt.
4. Start at task P03; acceptance criteria and dependencies are already documented.

## What is included

| Material | Location |
| --- | --- |
| Original 16-page brief, searchable extraction, original diagrams, checksum | [docs/source](docs/source/README.md) |
| Source facts, unresolved evidence, team and course deliverables | [Project brief](docs/PROJECT_BRIEF.md) |
| FR01-FR10 and nonfunctional requirements | [Requirements](docs/REQUIREMENTS.md), [machine-readable traceability](docs/requirements.json) |
| Architecture, technology defaults, design corrections | [Architecture](docs/ARCHITECTURE.md), [ADR 0001](docs/decisions/0001-prototype-design.md) |
| Entities, keys, indexes, RLS, trust ledger, normalization | [Database design](docs/DATABASE.md) |
| State transitions, claims, expiry, matching, impact definitions | [Domain rules](docs/DOMAIN_RULES.md) |
| REST contract, errors, idempotency and authorization | [API specification](docs/API.md) |
| Role screens and end-to-end demo | [UX specification](docs/UX.md), [demo script](docs/DEMO.md) |
| Synthetic data and missing real-world evidence | [Data guide](data/README.md), [fixtures](data/fixtures/demo.json) |
| Tests and course evidence templates | [Testing plan](docs/TESTING.md), [deliverables](docs/deliverables/README.md) |
| Local prerequisites and commands | [Development](docs/DEVELOPMENT.md) |

## Run locally

```sh
make setup
make install
make db-up
make migrate
make dev
```

Open `http://127.0.0.1:5173`. The frontend calls the API through Vite's `/api` proxy.
API documentation is at `http://127.0.0.1:8000/api/docs`. `make setup` creates an
ignored `.env` with an unprinted random local database password, preserving existing
configuration. Prerequisites and other working commands: [development](docs/DEVELOPMENT.md).

Checks:

```sh
make check lint typecheck test build
make e2e
make db-test
```

Compose starts PostgreSQL/PostGIS; `make migrate` installs the application schema.
Optional synthetic import: `make seed ANCHOR=2026-10-05T12:00:00Z`, then
`make ledger-verify`. Use a current UTC anchor for live claim examples and retain it
for repeat imports. Seeded accounts have disabled logins until P03 account setup.
Local startup and real API readiness have been verified.
The selected image is amd64, so Compose explicitly requests emulation on Apple
Silicon; see the [upstream image documentation](https://github.com/postgis/docker-postgis).

## Scope and evidence

The source PDF defines the project. Architecture and lifecycle refinements are
explicitly labelled in the decision record. Fixtures are synthetic, not collected
donor/NGO data. The supplied brief contains research claims that need source
verification before public presentation. No real interviews, pilot, notification-provider
integration, or TRL validation has been completed here. Foundation/database checks
pass; full authentication, delivery, worker and browser-workflow tests remain.

Repository: [ryanfer123/DBTHON-26](https://github.com/ryanfer123/DBTHON-26).
No software license was supplied; adding one is an owner decision.
