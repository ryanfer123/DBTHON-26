# DBTHON-26

**Decentralized Surplus Food & Perishable Redistribution Platform**

BCSE302P Database Systems Laboratory project by Ryan Fernandes (24BCE0565) and
Aritra Ghosh (24BCE0598), aligned with T5/T6 Waste & Circular Economy and Healthcare
& Well-being. Verified donors list safe surplus, receivers claim it once, volunteers
collect and deliver it, and administrators inspect accountability and impact.

This repository currently contains a complete implementation handoff and local
database infrastructure configuration. **Application code and database migrations
are still to be implemented.** See [current status](docs/STATUS.md).

## Begin implementation

1. Read [AGENTS.md](AGENTS.md).
2. Read the [project brief](docs/PROJECT_BRIEF.md), [requirements](docs/REQUIREMENTS.md),
   and [implementation plan](docs/IMPLEMENTATION_PLAN.md).
3. Use [START_HERE.md](docs/START_HERE.md) as the next coding-session prompt.
4. Start at task P01; acceptance criteria and dependencies are already documented.

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

## Commands available now

```sh
python3 scripts/validate_handoff.py
make check
```

Optional database-only setup, after configuring a local `.env`:

```sh
cp .env.example .env
# Fill POSTGRES_PASSWORD locally; do not commit .env.
docker compose config --quiet
docker compose up -d db
docker compose exec db psql -U dbthon -d dbthon -c 'SELECT PostGIS_Version();'
docker compose down
```

Compose starts only PostgreSQL/PostGIS. It does not install a schema, seed the data,
or start an application. Docker execution has not been verified during this handoff.
The selected image is amd64, so Compose explicitly requests emulation on Apple
Silicon; see the [upstream image documentation](https://github.com/postgis/docker-postgis).

## Scope and evidence

The source PDF defines the project. Architecture and lifecycle refinements are
explicitly labelled in the decision record. Fixtures are synthetic, not collected
donor/NGO data. The supplied brief contains research claims that need source
verification before public presentation. No real interviews, pilot, application
tests, notification-provider integration, or TRL validation has been completed here.

Repository: [ryanfer123/DBTHON-26](https://github.com/ryanfer123/DBTHON-26).
No software license was supplied; adding one is an owner decision.
