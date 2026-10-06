# Consolidated hosting package

This is a prepared replacement stack, not a deployed service. User authorization
covers preparation and local validation. No cloud resources or data were moved.

## Shape

`deploy/Dockerfile` builds the React website and the FastAPI application into one
non-root image. `scripts/serve.py` listens on `0.0.0.0:$PORT`. The website uses
relative `/api/v1` requests: sign-in, dashboard and workflows share the website's
origin. SPA deep links resolve to the shell; missing API routes and assets retain
404 responses. Same-origin production cookies use Secure and SameSite=Lax; existing
split-host installations retain their configured SameSite=None behavior. CSRF and
explicit origin checks still apply.

`deploy/render-single-platform.yaml` describes a new web service, separately
invocable worker, and PostgreSQL 17 database, all in Singapore. Existing
`render.yaml` and the AWS deployment drafts are preserved. This replacement has
paid service plans and automatic deployment disabled. It must not be applied as
an update to the existing static site.

Render documents [PostGIS support](https://render.com/docs/postgresql-extensions)
and [Blueprint fields](https://render.com/docs/blueprint-spec). Official schema
validation confirms configuration structure, not database privileges or deployment
readiness. Keep database access private (`ipAllowList: []`). Use same-region
internal connections for the independently restricted auth, runtime and worker
login roles. Never put the database owner URL in those settings.

## Prerequisites before provisioning

1. Resolve and test managed-role compatibility on a disposable managed database.
   Baseline migrations create `dbthon_guard` with BYPASSRLS. A provider's managed
   owner must not be assumed to have superuser/BYPASSRLS capabilities. The concurrent
   local RDS compatibility migration is intentionally excluded from this package.
   Do not remove FORCE RLS or relax the restricted connection checks to make the
   deployment pass. Review the guard policies and exercise the entire PostgreSQL
   security/workflow suite before selecting that migration for publication.
2. Agree on the service cost and authorize provisioning. This package alone does
   not authorize purchasing or changing the current live deployment.
3. Use a separate bootstrap environment with Alembic, authoritative SQL and seed
   files. The runtime image intentionally contains no owner credentials, migration
   runner or administrative fixture import. Follow existing database/access setup
   documentation after the managed-role gate is resolved.
4. Configure `APP_DATABASE_URL` and `AUTH_DATABASE_URL` only on the web service;
   configure `WORKER_DATABASE_URL` only on the worker. Supply `ALLOWED_ORIGINS` as
   a JSON list containing the exact public HTTPS origin on both. The API enforces
   distinct restricted roles and production TLS database connections.
5. Use a separate synthetic demo database if offering public demonstration logins.
   Public credentials, production separation and nightly reset are not implemented
   by this Blueprint. Never reset a database containing real members.
6. After approval and provisioning, verify public `/api/v1/health/ready`, real
   sign-in, CSRF rejection, role/zone isolation, claim concurrency, inbox processing
   and worker operation. DNS cutover and moving production data are separate work.

## Reproduce local package checks

```sh
docker build --platform linux/amd64 -f deploy/Dockerfile -t dbthon-consolidated:hardening .
docker run --rm -p 127.0.0.1:18080:8080 -e PORT=8080 dbthon-consolidated:hardening
```

Without restricted database settings, `/`, `/dashboard`, `/help` and liveness
work while readiness fails closed. This is a packaging smoke check, not proof of
live end-to-end operation. Actual database/browser tests are recorded in
[status](STATUS.md). Do not bake credentials into the image or command history.
