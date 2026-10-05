# Validation plan and evidence requirements

This defines full-prototype acceptance. P01-P03 foundation/database/identity checks have run;
observed evidence is in [STATUS.md](STATUS.md). Full T01-T12 completion remains pending.
Use fixed clock/fixtures for deterministic
logic; use real elapsed database time and real separate connections for lock tests.

| Test ID | Test family | Required proof |
| --- | --- | --- |
| T01 | Identity | Password hashing, login/logout/session expiry, unverified restrictions, rejected Admin self-assignment, normalized unique contacts, CSRF denial |
| T02 | Permissions | Role/owner/participant/zone denies through API and non-superuser SQL; hash-column protection; spoofed context blocked; pool identity resets; admin scope |
| T03 | Constraints | Zero/negative kg, invalid coordinates/time order/category/status/rating/FK rejected; valid records accepted; claimed edits denied |
| T04 | Time and expiry | Window not open, exact deadline, stale status reads, scheduled expiry without writes, late pickup/delivery denial, worker off feed correctness |
| T05 | Matching | Same zone/radius/capacity/verification; lon/lat order; equal-deadline distance tie; deterministic ID tie; EXPLAIN and load performance |
| T06 | Claim concurrency | Two real sessions/barrier, exactly one claim winner; unique-index bypass denial; same-key replay and mismatched-key-body conflict; cancellation/claim races; lock wait crosses expiry |
| T07 | Pickup lifecycle | Two-volunteer acceptance race, composite key routing, only assigned volunteer updates, timestamps ordered, missed/replacement history, overdue failure, completed reallocation denial |
| T08 | Ratings | Delivered participants only, each direction once, range checks, null unrated score, correct average/count, stranger/self/early denies |
| T09 | Ledger/atomicity | Fixed canonical hash vectors, sequence/genesis rules, simultaneous append no fork, rollback after injected failure, tampering detection, no runtime UPDATE/DELETE |
| T10 | Notifications | Correct match participants, atomic outbox rollback, duplicate event suppression, backoff/dead-letter, lease recovery, mark-read ownership, external adapter receipt before full FR08 |
| T11 | Analytics | Distinct mass across retries/joins; correct half-open time filters/zone snapshots; zero zones; picked-up vs delivered; null missing CO2e; export equivalence |
| T12 | Browser workflow | Login each role, verify, list, claim, accept, pickup, deliver, rate, report; mobile/keyboard, deep links, 409 refresh, empty/error states |

## Concrete competing-claim scenario

Seed one active listing and two verified same-zone receivers with sufficient capacity.
Use two independent PostgreSQL connections/transactions synchronized at a barrier;
execute the public claim operation in both. Assert one 201-equivalent success and one
409-equivalent rejection, one active claim, Claimed listing, exactly expected ledger/
outbox events, and no abandoned loser records. Repeat a winning idempotency key;
assert the same claim ID and no extra event. Do not sequentially call one connection
and label it a concurrency test.

For the expiry race, hold the listing lock in connection A, start B before deadline,
release A after deadline, and assert B rejects using post-wait database time. This
specifically catches authorization based on transaction-start `now()`.

## Worker/ledger/rollback tests

Inject a failure between domain update and ledger/outbox insertion; assert all
changes roll back. Concurrent commands affecting the same user must not fork the
chain. Verify an exported chain independently, alter a payload in an isolated test
copy, and assert detection. Never tamper with retained source/evidence to run a test.

Advance a controlled worker clock past scheduled grace and expiry, prove attempt/
claim/listing transitions and audit events, then retry the sweep with no duplicates.
Test production deadline routines with actual database timestamps as well.

## Benchmark and scenario simulation

Generate a reproducible 10,000-listing dataset across 4 zones plus a 7-day event
simulation. Keep it synthetic and record RNG seed, hardware, PostgreSQL/PostGIS
versions, client concurrency and sample count. Measure API p50/p95, SQL EXPLAIN
ANALYZE, successful allocation rate and claim latency; target nearby API p95 <2 s.
Do not use a prefiltered in-memory list to claim spatial database performance.

## Result recording

Use [testing-results template](deliverables/06-testing-validation.md). Record commit,
timestamp, command, environment, pass/fail counts, evidence paths, failures and
limitations. Browser screenshots support UX evidence but cannot establish database
atomicity. Fixtures and self-tests do not establish real-world impact or TRL 5.
