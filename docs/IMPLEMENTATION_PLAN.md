# Ordered implementation plan

P01-P10 core workflows are implemented and connected. P11-P12 evidence work remains;
FR08 external SMS/push is explicitly partial. The longer homepage and dark mode
extend the functional role screens.
Execute dependencies in order; use [STATUS.md](STATUS.md)
to resume. Each task must update requirement coverage and record actual checks.

## Milestone 1: runnable foundation and correct database

- [x] **P01 - Scaffold and developer workflow.** Create FastAPI and React/Vite apps
  in the prepared directories; dependency manifests/lockfiles; formatting/linting;
  health/readiness endpoints; frontend shell and API proxy; backend/web test setup.
  Add documented `dev`, `lint`, `typecheck`, `test`, `build` commands and CI jobs.
  Gate: fresh clone can install and start both apps, health responds, web renders,
  web typecheck/build and health test pass. Target files: apps/api, apps/web, Makefile,
  docs/DEVELOPMENT.md. No data mocks masquerading as a backend.
- [x] **P02 - Schema, programmability and seeds.** Depends P01. Add Alembic baseline
  for all original entities and specified extensions, PostGIS, constraints/indexes,
  runtime roles/RLS, transition guards, views and a claim routine. Implement fixture
  importer rebased to a supplied clock and repeatable disposable DB reset. Include
  normalization/ER mapping and useful SELECT/JOIN/aggregate examples in database/.
  Gate: migrate empty PostgreSQL, run constraint tests, seed twice without duplicates,
  verify extensions/indexes, enforce runtime grants, reconcile hand-calculated totals.
  Tests T03/T05/T09/T11 begin here; do not substitute SQLite.
- [x] **P03 - Identity, roles and verification.** Depends P02. Registration, Argon2id,
  session auth/revocation, CSRF, capacity profile, scoped admin verification and safe
  DTOs. Implement authentication transaction context/RLS plumbing and audit events.
  Gate: T01/T02 pass including privilege escalation and pooled-connection isolation;
  no password hashes in public responses. FR01; NFR04.

## Milestone 2: one real claim-to-delivery vertical slice

- [x] **P04 - Listing service and geo-temporal feed.** Depends P03. CRUD, time-relative
  validation, immutable zone snapshot, generated geography, GiST, live/capacity/zone
  filters, urgency/distance ordering and countdown fields. Gate: T03/T04/T05 pass;
  EXPLAIN captured; terminal or claimed edits denied. FR02/FR03/FR04.
- [x] **P05 - Atomic claims, ledger and cancellation.** Depends P04. Implement listing
  locks, database-time recheck after wait, unique allocation index, idempotency storage,
  coordinated cancellations, per-user canonical chain append/verifier and outbox
  commit. Gate: T06/T09 pass on real concurrent PostgreSQL sessions, rollback leaves
  no domain/ledger/outbox debris, duplicate retries reuse the same claim. FR04/FR07.
- [x] **P06 - Volunteer acceptance and delivery.** Depends P05. Task query, one active
  composite-key attempt, scheduled acceptance, pickup, timely delivery and failure
  paths, missed/replacement history. Gate: T07 plus T06/T09 regressions pass; delivered
  states remain permanently unallocatable. FR05.
- [x] **P07 - Expiry worker and durable in-app notifications.** Depends P06. Minute
  sweeps, missed-pickup grace, overdue-delivery failure, notification leases/backoff,
  deduplicated inbox and read events. Gate: T04/T10 and rollback/ledger regression
  tests pass; state expires without a user update and a crashed worker recovers leases.
  FR03/FR07; FR08 in-app portion only.
- [x] **P08 - Participant ratings and trust score.** Depends P06. Completion-only
  reciprocal ratings, unique directions, score validation, average/count view, ledger
  event verification. Gate: T08/T09 pass with stranger/self/duplicate/early-rating
  denials. FR06/FR07.

## Milestone 3: complete role workflows and reports

- [x] **P09 - Frontend integration and channel adapter.** Depends P03-P08. Implement
  docs/UX.md screens against actual endpoints, cookie/CSRF flow, loading/error/empty
  states, race handling, countdown and accessible mobile layout. Add notification
  adapter interface and one push/SMS implementation only if separately configured;
  otherwise document FR08 external delivery as blocked/partial. Gate: T12 end-to-end
  browser workflow plus lint/typecheck/build; T10 adapter/retry tests. No claim of
  external delivery without provider receipt/observed device evidence.
  Core P09 is complete: domain/account/inbox/trust screens and durable in-app
  delivery work. External SMS/push remains explicitly partial/unconfigured; no
  provider receipt or device delivery is claimed. See STATUS.md for browser evidence.
- [x] **P10 - Admin analytics and export.** Depends P06/P08/P09. Scoped zone/city/date
  dashboards, picked-up/delivered distinction, factor-labelled estimates, exports
  and latency/participation counts. Gate: T11/T02 pass; source/fixture totals reconcile;
  CSV and screen filters match; missing CO2e factor stays null. FR09/FR10.

## Milestone 4: course demonstration and validation

- [ ] **P11 - Full regression and controlled demo.** Depends P01-P10. Run T01-T12,
  seeded week simulation (3-4 zones), race demo, 10k-listing feed benchmark, negative
  permissions and tampering proof. Prepare reproducible screenshots/results with
  commands, hardware, commit ID and limitations. Gate: clean-clone reproduction;
  all prototype FRs covered, any external-channel/availability limits explicit.
  Controlled evidence can support TRL 4 review, not stakeholder-validated TRL 5.
- [ ] **P12 - Stakeholder, impact and Expo package.** Depends P11 plus real collected
  evidence. Use donor/receiver interview template; obtain permission for a bounded
  pilot separately; verify research references and emissions assumptions; append
  real results; prepare presentation and run demo. Gate: all eight deliverables have
  evidence; TRL level matches actual validation. Do not fabricate evidence to finish.

## Completion definition

A prototype is done only when runnable apps, reproducible migrations/seeds, core
workflow, PostgreSQL concurrency/permissions/ledger tests, frontend E2E, reconciled
reports, and required course artifacts are present. External FR08, physical zone
availability and real validation cannot be silently counted as complete. Record
the exact limitation and next action. Post-Expo roadmap: role-specific profiles,
cross-city physical deployment/partitioning, operational notification expansion and
independent ledger checkpoints after measured need and authorization.
