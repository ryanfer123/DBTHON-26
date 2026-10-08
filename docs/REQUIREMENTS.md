# Requirements and acceptance criteria

Source requirements: PDF section 4.2 (physical p. 6). IDs are assigned here for
traceability. Implementation refinements are identified in ADR 0001. All FRs are
tracked in [requirements.json](requirements.json). FR01-FR07 and FR09-FR10 have
implemented API/browser workflows. FR08 is partial: durable in-app delivery works;
external SMS/push remains unconfigured. Performance/pilot evidence remains P11/P12.
Observed checks: [STATUS.md](STATUS.md).

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

## UI/UX extension coverage

The usability extension preserves FR01-FR10 and NFR01-NFR06; map discovery and bounded thumbnails extend FR02/FR03, safe trust projections extend FR07, and exact chart/public aggregation extends FR09. CSRF, whole-quantity allocation, row locks, zone RLS and atomic audit/outbox remain mandatory. Verification is recorded in [UI implementation evidence](UI_UX_IMPLEMENTATION.md).

## Community feature extensions

These are additional user-requested capabilities beyond the source PDF's FR01-FR10:

| ID | Capability | Acceptance criteria |
| --- | --- | --- |
| CF01 | Food-needs board | Approved same-zone Receivers post dated needs; approved Donors link their own live whole listing; recipients use the existing claim path; needs close on owner/admin action, deadline, or fully delivered target quantity. |
| CF02 | Pickup-time agreement | Volunteer proposes; donor and receiver accept; any participant can reschedule; every new version resets agreement and collection is blocked until all three current participants accept. |
| CF03 | Community updates | Zone Admins publish announcements/partner resources; approved members suggest; admins publish/reject; pending members can read only current published updates in their zone. |

All writes use existing guarded PostgreSQL routines, restricted roles, RLS, CSRF,
idempotency, trust-ledger and in-app notification outbox. Feature verification
appears in [STATUS.md](STATUS.md).

## Donor reliability extensions

| ID | Capability | Release gate |
| --- | --- | --- |
| DF01 | Real SMS/WhatsApp demo alerts | Opt-in, one approved recipient, database daily cap, provider acceptance and separately observed delivery; no claimed free permanent transport. |
| DF02 | Daily donor schedules | Approved donor saves an owned listing template and local clock/time zone; one due reminder per occurrence; fresh donor confirmation before publication; pause/resume. |
| DF03 | Handling and ingredient checklist | Donor declares hot/cold/ambient handling, packing, known allergens and optional diet tags; timestamped on listing; no safety certification. |
| DF04 | Diet/allergen feed filters | Halal/Jain/nut-free and explicit allergens validated server-side, filter-bound cursors, unknown declarations excluded from allergen-exclusion results. |
| DF05 | Installable mobile shell | Manifest/icons, install guidance and offline collection guidance; private data and writes never cached or queued. |
| DF06 | Real pilot evidence | Permission-based campus mess and NGO notes/quotes plus a separately approved collection; templates are not evidence. |

Implementation is on the feature branch. Release checks and provider/pilot evidence remain open; see STATUS.md.

## Researched community experience extensions

| ID | Capability | Acceptance/release criteria |
| --- | --- | --- |
| CE01 | Private saved listings | Own-account saves only; no reservation/notification; pagination; expiry/status hiding; bounded storage. |
| CE02 | Exchange messages | Current verified participant and recipient snapshot checks; replacement-volunteer privacy; read-only terminal exchanges; rate limits and atomic audit/outbox. |
| CE03 | Evidence-linked issue review | Own report history; scoped admin queue; exact reported-message evidence only; no self-review; idempotent outcomes; no allocation or safety bypass. |
| CE04 | Personal participation impact | Own current-zone totals; collected and delivered separated; retries deduplicated; overlapping roles and meal estimates labelled; fixture presence disclosed; selected-period impact score is rounded delivered kg × 10 with transparent formula and 100-point milestone progress. |
| CE05 | Agreed pickup calendar | Export only after all current participants agree; stable UID/version; no contacts; reschedule refresh guidance. |

Source implementation and researched rationale: [comparison](COMPETITOR_GAP_ANALYSIS.md).
Runtime acceptance evidence remains pending; these extensions do not change core
FR01–FR10 or produce real pilot evidence.

### Food discovery follow-up (2026-10-09)

FR04 search now has explicit prefix matching selected by the UI, automatic typing
updates, visible donor category/diet/allergen controls, and deadline/newest ordering
across paginated matches. Existing radius/zone/capacity rules remain unchanged. Static
checks establish compilation only; PostgreSQL/browser behavior is not yet demonstrated
for this follow-up. Deploy the updated backend before the frontend.

### Account management extension

Users can permanently delete account access/profile details from Settings; admins can delete scoped members from Community members. Confirmation is explicit, active exchanges and main/final-area-admin deletion are guarded, and transaction/audit history remains under a pseudonymous identity. Migration `0014` and both DELETE endpoints are implemented; runtime database and browser acceptance evidence remains pending.
### Browser push extension (2026-10-08)

FR08 now has implementation for explicit per-browser opt-in, authenticated/CSRF
subscription persistence, atomic delivery enqueueing, Web Push transport, generic
lock-screen previews, inbox click navigation and opt-out/sign-out cleanup. Migration
0013 and the optional AWS relay are not deployed. Actual browser receipt and current
AWS allowance review remain mandatory before treating FR08 as fully demonstrated.
See [browser push activation](BROWSER_PUSH.md).
