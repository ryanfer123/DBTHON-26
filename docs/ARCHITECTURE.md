# Architecture and repository boundaries

Source baseline: PDF p. 7, [original figure](source/figures/architecture-page-07.png).
Implementation default: modular monolith; logically scoped zones in one PostgreSQL
database, not independent databases or a blockchain network.

```mermaid
flowchart TD
    Web[React role interfaces] --> API[FastAPI REST and session auth]
    API --> Listings[Listing and matching modules]
    API --> Claims[Claim and pickup modules]
    API --> Trust[Verification ratings and ledger]
    API --> Reports[Analytics and admin]
    Listings --> DB[(PostgreSQL and PostGIS)]
    Claims --> DB
    Trust --> DB
    Reports --> DB
    Worker[Expiry and notification worker] --> DB
    Worker --> Provider[Optional SMS or push adapter]
```

## Implemented module boundaries

| Boundary | Responsibilities | Suggested target |
| --- | --- | --- |
| Identity | Registration, Argon2id, opaque sessions, role verification | `apps/api/app/identity/` |
| Listings | CRUD, ownership, expiry, zone snapshots | `apps/api/app/workflows/` |
| Matching | Geography, capacity, urgency ranking | `apps/api/app/workflows/service.py` |
| Claims | Locks, whole-listing allocation, idempotency, cancellation | `database/0003_workflows.sql` |
| Pickups | Volunteer assignment, attempt history, pickup/delivery | `apps/api/app/workflows/` |
| Trust | Per-user append service, verifier, participant ratings | `apps/api/app/trust/` |
| Notifications | Transactional outbox, durable in-app inbox, adapter retries | `apps/api/app/workflows/worker.py` |
| Analytics | Zone/city aggregates and filtered report exports | `apps/api/app/workflows/service.py` |
| Shared | Configuration, DB transaction context, errors, clock interface | `apps/api/app/core/` |
| Worker | Expiry sweeps and notification delivery loops | `scripts/worker.py` |

Route handlers validate/serialize requests, services implement business operations,
and repositories execute queries within an explicit transaction. Avoid hidden
commits inside repositories. Use one database transaction for each domain command.

## Identity and database access

Use opaque server-side sessions in HttpOnly cookies. Local development uses Vite's
`/api` proxy to avoid cross-origin cookie surprises. Production cookies must be
Secure; protect cookie-authenticated writes with a CSRF token and origin checks.
Use Argon2id rather than inventing password hashing. Session IDs are random, stored
as hashes, revoked on logout, and expire after a documented policy interval.

The API uses a non-superuser, non-table-owner runtime database role. Each transaction
sets a transaction-local private session hash from the authenticated cookie. The
database resolves the actor and zone from its own session/user tables and ignores
raw actor/zone GUCs. Never accept a numeric impersonation context from a body/header.
FORCE RLS where applicable. Migration/seed and worker
roles have separate privileges; the worker has only the routines/tables it needs.
An authenticated session itself is not proof of verified role eligibility.
P03 implements separate auth/runtime login pools and fail-closed connection checks;
see [identity protocol](IDENTITY.md) for local setup, CSRF and approval behavior.

## Operational boundaries

Keep API and worker separately invocable but backed by the same codebase. Polling
is sufficient for the prototype's feed/inbox. Do not add Redis, a message broker,
microservices, Kubernetes, or paid map services without a demonstrated need.
Raw coordinates and a simple map/list view suffice; exact receiver and volunteer
addresses must not be published to arbitrary feed viewers.

Support request IDs and structured logs with IDs, errors, timing and transition
names. Exclude hashes, session contents, passwords, exact personal coordinates and
phone numbers. Provide liveness separately from database readiness. Never claim
zone availability independence while all transactions share one database process.

## Prepared same-origin option

The optional [consolidated hosting package](CONSOLIDATED_HOSTING.md) serves the
built SPA through FastAPI and runs the worker separately from the same image.
It is a prepared replacement, not a cloud deployment. Existing cross-origin
configuration remains supported. The dashboard uses authenticated ETag/304
responses; each poll still recomputes scoped counts in PostgreSQL.

## Deployed AWS/Render topology

The selected deployment serves the React website on Render and the FastAPI API on
AWS Lambda, with the retained private RDS PostgreSQL database. The expiry/inbox
worker runs separately through an EventBridge minute schedule. The operator-only
initializer applies migrations and provisions restricted login roles; public API
and worker functions do not receive the owner credential. See
[AWS/Render connection](AWS_RENDER_CONNECTION.md) for the template, cookie/origin
configuration, managed-role migration and operational limits.


## UI experience release

Maps are an explicitly opened, lazy Leaflet chunk using OpenStreetMap attribution
and normal browser tile caching. No bulk prefetch or offline tile warming is
performed. Coordinate controls and textual food listings remain usable without
maps. Only donor pickup points and the viewer's own radius are plotted; participant
delivery coordinates remain in authorised exchange links, never in discovery maps.
Authenticated photo blobs stay in PostgreSQL within the existing restricted-role
architecture; there is no new storage service or public photo URL. Thumbnails are
normalized independently on the server and moderation is audited. Public impact
is a dedicated aggregate routine, separate from private zone-scoped admin reports.
See [UI implementation evidence](UI_UX_IMPLEMENTATION.md).
