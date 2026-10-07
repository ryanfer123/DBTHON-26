.PHONY: check setup install dev backend-dev frontend-dev api-dev web-dev lint typecheck test build e2e openapi db-config db-up db-down migrate seed db-test ledger-verify reset-test db-access worker feed-plan

check:
	python3 scripts/check_migrations.py
	python3 scripts/validate_handoff.py

setup:
	python3 scripts/setup_local.py

install:
	uv sync --project backend --locked
	npm ci --prefix frontend

dev:
	python3 scripts/dev.py

backend-dev: api-dev

frontend-dev: web-dev

api-dev:
	uv run --project backend --locked uvicorn app.main:app --app-dir backend --reload --reload-dir backend/app --host 127.0.0.1 --port 8000

web-dev:
	npm run dev --prefix frontend

lint:
	uv run --project backend --locked ruff check backend
	npm run lint --prefix frontend

typecheck:
	uv run --project backend --locked mypy --config-file backend/pyproject.toml backend/app
	npm run typecheck --prefix frontend

test:
	uv run --project backend --locked pytest backend/tests
	npm test --prefix frontend

build:
	npm run build --prefix frontend

e2e:
	npm run test:e2e --prefix frontend

openapi:
	uv run --project backend --locked python scripts/export_openapi.py

migrate:
	uv run --project backend --locked python scripts/database.py migrate

db-access:
	uv run --project backend --locked python scripts/provision_access.py

seed:
	uv run --project backend --locked python scripts/database.py seed $(if $(ANCHOR),--anchor $(ANCHOR),--anchor-now)

db-test:
	uv run --project backend --locked pytest backend/tests --db

ledger-verify:
	uv run --project backend --locked python scripts/database.py verify

reset-test:
	uv run --project backend --locked python scripts/database.py reset-test

db-config:
	docker compose config --quiet

db-up:
	docker compose up -d db

db-down:
	docker compose down

worker:
	uv run --project backend --locked python scripts/worker.py

feed-plan:
	uv run --project backend --locked python scripts/feed_plan.py
