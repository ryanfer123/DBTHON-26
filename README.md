# DBTHON-26

**Second Table: community-operated, zone-partitioned food redistribution**

The course brief retains its original title, “Decentralized Surplus Food &
Perishable Redistribution Platform”. The implementation uses one shared PostgreSQL
database with logical zone isolation and local role approval; it does not provide
independent zone databases, physical partitioning, or distributed consensus.

BCSE302P Database Systems Laboratory project by Ryan Fernandes (24BCE0565) and
Aritra Ghosh (24BCE0598), aligned with T5/T6 Waste & Circular Economy and Healthcare
& Well-being. Verified donors list safe surplus, receivers claim it once, volunteers
collect and deliver it, and administrators inspect accountability and impact.

The web app supports registration and zone-admin approval, donor listings, nearby
receiver discovery and claims, volunteer pickup/delivery, expiry processing, an
in-app inbox, participant ratings, trust history and scoped impact reports with CSV.
FastAPI and React use real PostgreSQL/PostGIS transactions and restricted database
roles. External SMS/push delivery and stakeholder/pilot evidence remain outstanding.
See [current status](docs/STATUS.md).
The expanded homepage includes handover guidance, FAQs and role-aware links. Use the
sun/moon control in the header to switch themes; your preference persists across visits.
After sign-in, `/dashboard` shows exact role-specific totals and upcoming work.
A grouped desktop sidebar and mobile Dashboard / Tasks / Inbox / More navigation
connect every approved role. Food search, URL filters, Previous/Next pages and
searchable `/help` preserve useful destinations. See [usability details](docs/design/WORKSPACE_USABILITY.md).

## Begin implementation

1. Read [AGENTS.md](AGENTS.md).
2. Read the [project brief](docs/PROJECT_BRIEF.md), [requirements](docs/REQUIREMENTS.md),
   and [implementation plan](docs/IMPLEMENTATION_PLAN.md).
3. Use [START_HERE.md](docs/START_HERE.md) as the next coding-session prompt.
4. Start at task P11 for controlled demonstration/performance evidence; implementation boundaries are documented.

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
| High-end frontend redesign and migration plan | [Frontend migration plan](docs/FRONTEND_MIGRATION_PLAN.md) |
| Synthetic data and missing real-world evidence | [Data guide](data/README.md), [fixtures](data/fixtures/demo.json) |
| Tests and course evidence templates | [Testing plan](docs/TESTING.md), [deliverables](docs/deliverables/README.md) |
| Local prerequisites and commands | [Development](docs/DEVELOPMENT.md) |
| Render static website configuration | [Render deployment](docs/RENDER_DEPLOYMENT.md), [Blueprint](render.yaml) |

## Repository layout

| Directory | Contents |
| --- | --- |
| `backend/` | FastAPI application, Alembic migrations, and Python tests |
| `frontend/` | React/Vite application and browser tests; deployed as the Render static site |
| `database/`, `infra/`, `deploy/` | SQL migrations, AWS infrastructure, and deployment packaging |
| `docs/`, `scripts/`, `data/` | Project documentation, shared tooling, and synthetic fixtures |

The API and database remain on AWS; Render hosts the frontend.

## Run locally

```sh
make setup
make install
make db-up
make migrate
make db-access
make dev
```

Open `http://127.0.0.1:5173`. The frontend calls the API through Vite's `/api` proxy.
Use **Join your community** to register, **Sign in** to access `/account`, and
**Review community members** from an approved admin account to open `/admin`.
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
for repeat imports. Enable a synthetic account with a locally entered password:
`uv run --project backend python scripts/demo_password.py --user 104` (zone-1 admin).
See [identity setup and API headers](docs/IDENTITY.md); no shared password is in Git.
Local startup and real API readiness have been verified.
The selected image is amd64, so Compose explicitly requests emulation on Apple
Silicon; see the [upstream image documentation](https://github.com/postgis/docker-postgis).

## Scope and evidence

The source PDF defines the project. Architecture and lifecycle refinements are
explicitly labelled in the decision record. Fixtures are synthetic, not collected
donor/NGO data. The supplied brief contains research claims that need source
verification before public presentation. No real interviews, pilot, notification-provider
integration, or TRL validation has been completed here. Core database, API, delivery,
worker and browser workflows are implemented and verified locally. The controlled
multi-zone simulation, 10k-listing benchmark and broader clean-clone evidence remain
P11 work; real stakeholder/pilot evidence remains P12 work.

Repository: [ryanfer123/DBTHON-26](https://github.com/ryanfer123/DBTHON-26).
No software license was supplied; adding one is an owner decision.

## Hosting preparation and hardening

The [consolidated hosting package](docs/CONSOLIDATED_HOSTING.md) serves the website
and API from one origin and supplies a replacement Render Blueprint. Its managed
database bootstrap gate must pass before provisioning. See the
[product hardening audit](docs/PRODUCT_HARDENING.md) for implemented changes and
remaining work from the product review.

The selected AWS backend connection is described in [AWS/Render integration](docs/AWS_RENDER_CONNECTION.md). It reuses the retained private RDS database and supplies a separate Lambda API/worker stack. See status for live verification.

The UI experience release and its verification/limitations are tracked in [UI/UX implementation evidence](docs/UI_UX_IMPLEMENTATION.md).

## Donor reliability feature branch

Daily donor reminders, batch handling/allergen declarations, diet/allergen filters
and an installable offline guidance shell are prepared on `feat/donor-safety-alerts`.
Real alert setup: [provider demo guide](docs/REAL_ALERTS.md). Stakeholder materials:
[interview guide](docs/pilot/INTERVIEW_GUIDE.md) and [bounded pilot worksheet](docs/pilot/BOUNDED_PILOT.md).
Release/runtime evidence remains pending as recorded in STATUS.md.
