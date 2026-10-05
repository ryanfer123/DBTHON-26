.PHONY: check setup install dev api-dev web-dev lint typecheck test build e2e openapi db-config db-up db-down migrate seed db-test ledger-verify reset-test

check:
	python3 scripts/validate_handoff.py

setup:
	python3 scripts/setup_local.py

install:
	uv sync --project apps/api --locked
	npm ci --prefix apps/web

dev:
	python3 scripts/dev.py

api-dev:
	uv run --project apps/api --locked uvicorn app.main:app --app-dir apps/api --reload --host 127.0.0.1 --port 8000

web-dev:
	npm run dev --prefix apps/web

lint:
	uv run --project apps/api --locked ruff check apps/api
	npm run lint --prefix apps/web

typecheck:
	uv run --project apps/api --locked mypy --config-file apps/api/pyproject.toml apps/api/app
	npm run typecheck --prefix apps/web

test:
	uv run --project apps/api --locked pytest apps/api/tests
	npm test --prefix apps/web

build:
	npm run build --prefix apps/web

e2e:
	npm run test:e2e --prefix apps/web

openapi:
	uv run --project apps/api --locked python scripts/export_openapi.py

migrate:
	uv run --project apps/api --locked python scripts/database.py migrate

seed:
	uv run --project apps/api --locked python scripts/database.py seed $(if $(ANCHOR),--anchor $(ANCHOR),--anchor-now)

db-test:
	uv run --project apps/api --locked pytest apps/api/tests --db

ledger-verify:
	uv run --project apps/api --locked python scripts/database.py verify

reset-test:
	uv run --project apps/api --locked python scripts/database.py reset-test

db-config:
	docker compose config --quiet

db-up:
	docker compose up -d db

db-down:
	docker compose down
