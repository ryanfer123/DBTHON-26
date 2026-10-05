# Requirements and acceptance criteria

Source requirements: PDF section 4.2 (physical p. 6). IDs are assigned here for
traceability. Implementation refinements are identified in ADR 0001. All FRs are
currently **not implemented**. Machine-readable mapping: [requirements.json](requirements.json).

| ID | Source requirement | Prototype acceptance gate | Tasks / tests |
| --- | --- | --- | --- |
| FR01 | Register and verify user roles and zone | Registration creates an unverified identity; admin verifies approved roles in its zone; public registration cannot grant Admin; login/logout works | P03; T01, T02 |
| FR02 | Donor creates, updates, cancels food listings | Verified donor owns mutations; quantity/time/coordinates constrained; available-only edits; coordinated cancellation after claim | P04, P05; T03, T06 |
| FR03 | Remaining expiry time and approaching-expiry warning | Feed and details derive time from server; warning <=30 min; worker changes stale state without user writes; exact expiry rejected | P04, P07; T04 |
| FR04 | Ranked zone feed and transaction-safe claim | Only live same-zone radius/capacity matches; deterministic urgency/distance ordering; one winner in competing PostgreSQL transactions | P04, P05; T05, T06 |
| FR05 | Volunteer accepts task, records pickup/delivery | Verified same-zone volunteer; one accepted attempt; legal transitions only; composite pickup key/history; deadlines enforced | P06, P07; T07 |
| FR06 | Both parties rate and update trust score | Delivered claim only; donor/receiver reciprocal eligibility; score 1-5; one rating per direction; derived score/count | P08; T08 |
| FR07 | Append every state-changing action to per-user ledger | Domain mutation and hash event atomic; sequence/hash continuity and payload verifiable; concurrent appends cannot fork | P05-P08; T09 |
| FR08 | Push/SMS alerts to matches and status participants | Persistent in-app events + retries first; at least one external channel adapter and real delivery evidence before claiming full FR08 | P07, P09; T10 |
| FR09 | Admin dashboards by zone/city | Approved zones only; listings, claims, pickups and impact aggregates reconcile to transactions | P10; T02, T11 |
| FR10 | Kg, meal, estimated CO2e reports by range/zone | Deduplicated picked-up and delivered totals; explicit factor labels; missing CO2e factor gives null; export filters match screen | P10; T11 |

## Nonfunctional requirements

| ID | Requirement from PDF p. 6 | Concrete prototype gate |
| --- | --- | --- |
| NFR01 | ACID integrity | Constraint, rollback, double-claim and retry tests on PostgreSQL; no partial domain/ledger/outbox commits |
| NFR02 | Nearby queries within a couple seconds | Target p95 <2 s API latency on 10,000 synthetic listings, documented machine/load; capture EXPLAIN ANALYZE for zone/spatial/expiry query |
| NFR03 | Zone independence / availability | Logical zone isolation and limited locks demonstrated; shared database outage isolation remains explicitly deferred |
| NFR04 | RBAC, privacy, password hashing | Explicit ownership/zone policies; restricted DB role; RLS negative tests; Argon2id; sensitive fields absent from responses/logs |
| NFR05 | Auditability | Ordered, append-only user event chain; independent verification and tamper test; event versioning documented |
| NFR06 | Multi-city scalability | Stable zone IDs on historical records, city filters, index plans; physical replication/partitioning is roadmap work |

## Readiness boundaries

A controlled demo with fixtures can satisfy prototype functional tests, but cannot
prove societal impact or TRL 5. External channel setup, stakeholder evidence,
emissions-factor validation and real pilot measurements remain evidence tasks.
Record partial requirements explicitly rather than marking the entire prototype done.
