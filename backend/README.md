# Backend

FastAPI application, PostgreSQL/PostGIS data access, Alembic migrations, and Python
unit/integration tests. The API and worker are deployed on AWS; Render serves only
the React frontend.

From the repository root, use `make backend-dev` to start the API, `make worker` for
the worker, `make migrate` for schema migrations, and `make db-test` for opt-in
PostgreSQL integration checks. See [development](../docs/DEVELOPMENT.md),
[API contract](../docs/API.md), and [database design](../docs/DATABASE.md).
