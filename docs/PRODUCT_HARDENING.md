# Product hardening audit and next work

The user's 15-point review is a request, not evidence that every alleged omission
exists. The course PDF remains source evidence. This audit distinguishes observed
code, changes in this iteration and remaining work; pilot evidence remains incomplete. The selected AWS/Render deployment is recorded
in [STATUS.md](STATUS.md).

| Review area | Current evidence and remaining work |
| --- | --- |
| Consolidated hosting | Same-origin container and replacement Render Blueprint prepared and locally checked. The selected AWS/Render topology is deployed with private RDS and verified live authentication. Single-platform Render remains an unapplied alternative. See [connection](AWS_RENDER_CONNECTION.md). |
| Public demo | Synthetic fixtures and isolated browser-test accounts exist. Public role logins and a safe nightly reset on a separate database remain pending. |
| Decentralization language | README now says community-operated, zone-partitioned. One shared PostgreSQL database provides logical zone isolation; independent databases/consensus are not implemented. Original course title is retained as provenance. |
| Matching and notifications | Listing create/update already enqueue same-zone, verified, approved, capacity-eligible receiver notifications within 5 km when the listing is currently collectable. The worker delivers the in-app inbox. Future collection-window activation fan-out needs separate work. Authorized exchange participants now get WhatsApp click-to-chat; sending remains their action. No automated external delivery is claimed. |
| Database routine security | A new real-PostgreSQL catalog test checks pinned search paths and no PUBLIC EXECUTE for every public `dbthon_*` SECURITY DEFINER routine. Existing `dbthon_command` dispatch/refactoring remains pending. |
| Migration drift | Numbered SQL files are authoritative; Alembic already loads them. `scripts/check_migrations.py` now enforces one loader per SQL file and rejects duplicate inline upgrade SQL in handoff CI. No new migration in this iteration. |
| Privacy | Existing ledger events use IDs and action metadata rather than profile values; this does not make all application data anonymous. Retention, deletion/anonymization design and delete-account workflow remain pending. No claim of legal compliance. |
| Chain assurance | New authenticated full-own-chain endpoint and UI invoke the independent Python verifier, including every entry beyond page boundaries. Explicitly warns that an owner can rewrite the entire chain. Independent external checkpoint witnessing/signing remains pending. |
| Food safety | Current category/window checks do not establish a category-specific safety policy. Ingredients/allergens, storage/handling declarations, commercial registration checks, condition acceptance and photos remain pending. Do not invent safe-hours limits or label the prototype food-safety certified. |
| Operations | New JSON HTTP logs include request IDs, route templates, status and elapsed time without bodies/query strings/contact values. Existing outbox retry/failed states remain. Metrics, tracing, alerts, heartbeat and dead-letter operator tools remain pending. |
| Conditional polling | Overview now supports actor-scoped ETag/304. The client keeps one account-scoped in-memory response and discards it across sign-out/account changes. Existing visible-tab 15-second refresh stays; database queries still run on each poll. This reduces transfer, not database work. |
| Geo limitation | Matching uses straight-line PostGIS distance from saved coordinates. Five kilometres is not road travel distance; routing remains outside the prototype. |
| Scale/coverage | Existing PostgreSQL/browser regression suites remain. A 50-claimer workload, 10k-listing API p95 benchmark and coverage gate still need measured evidence. P11 is not complete. |
| Frontend additions | Dashboard/sidebar/mobile menus and URL-restored filters are published in the prior usability release. TanStack Query adoption, Tamil and volunteer PWA remain pending. |
| Stakeholder/pilot evidence | Real interviews and controlled pilot are not conducted by code changes. P12 and TRL 4/5 evidence remain pending; no fabricated outcomes. |

Next implementation task: production administrator onboarding, then the separate
synthetic demonstration/reset workflow. Preserve concurrent AWS/RDS drafts.
Real-data migration remains outside the authorized connection work.
