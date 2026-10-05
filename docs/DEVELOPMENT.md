# Developer setup and command status

## Available now

Only Python 3.12+ is needed to validate the handoff; the checker uses the standard
library and does not need package installation or network access.

```sh
python3 scripts/validate_handoff.py
```

For the optional database configuration use Docker Engine/Desktop and Compose v2:

```sh
cp .env.example .env
# Supply POSTGRES_PASSWORD in the local ignored .env.
docker compose config --quiet
docker compose up -d db
docker compose exec db psql -U dbthon -d dbthon -c 'SELECT PostGIS_Version();'
docker compose down
```

Compose binds only localhost and persists a named volume. Changing `.env` values
does not update credentials in an already initialized volume. `down` preserves data;
only use volume deletion on an explicitly disposable local database. The Compose
user is a bootstrap owner, not the eventual restricted API runtime identity.
No schema/seeding/application startup is configured yet.

Upstream `postgis/postgis:17-3.5` advertises amd64 support and uses the PostgreSQL
17 volume path `/var/lib/postgresql/data`. Compose requests amd64 explicitly so an
Apple Silicon machine can use emulation. Validate actual runtime support at P01/P02.
References: [upstream image](https://github.com/postgis/docker-postgis),
[Compose interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).

## Commands P01/P02 must add

These are the target conventions, **not working commands yet**:

| Area | Target command / prerequisite |
| --- | --- |
| Backend install | `uv sync --project apps/api` after pyproject.toml and uv.lock exist |
| API server | From apps/api: `uv run uvicorn app.main:app --reload --port 8000` |
| Migrations | From apps/api: `uv run alembic upgrade head` after Alembic setup exists |
| Fixture import | From apps/api: `uv run python -m app.seed --fixture ../../data/fixtures/demo.json --anchor-now` after importer exists |
| Backend tests | From apps/api: `uv run pytest` with dedicated PostgreSQL test database |
| Frontend install | From apps/web: `npm ci` after package.json and package-lock.json exist |
| Frontend dev | From apps/web: `npm run dev` with `/api` proxy to port 8000 |
| Frontend checks | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| Browser E2E | Chosen browser runner against seeded app; document exact command in P09 |
| Worker | From apps/api: `uv run python -m app.worker` after worker exists |

Choose a supported Python runtime (default 3.12+) and Node LTS at scaffold time;
record exact versions/lockfiles in the repository. Do not assume the host Python
version matches dependency support. Use dedicated test resources; never run cleanup
tests against a deployment database. Every command added must be exercised and its
actual result recorded in STATUS.md.

## Git on this initialization machine

The `/usr/bin/git` launcher is blocked by an Xcode license check on this host.
The installed direct binary `/Library/Developer/CommandLineTools/usr/bin/git` worked
for cloning and can perform repository operations without changing system settings.
This path is a local convenience, not a project prerequisite on other machines.
