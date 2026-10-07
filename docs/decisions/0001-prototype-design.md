# ADR 0001: implementable prototype defaults

Date: 2026-10-05. Status: adopted; public app and database foundation implemented.
Source: PDF pp. 5-15. These choices are not quotations from the brief.

| Gap / ambiguity | Adopted decision | Reason / alternative |
| --- | --- | --- |
| Backend/frontend stack unspecified | FastAPI + SQLAlchemy/Alembic; React/TypeScript/Vite | Small REST prototype with visible SQL and testable services. A TypeScript backend is viable, but do not maintain two implementations. |
| Single `Role` field vs people having multiple roles | `user_roles(user_id, role)` junction table | Preserve one identity while enabling simultaneous roles. A single current role is simpler but cannot satisfy the stated multi-role intent. |
| Receiver capacity has no schema field | Optional `receiver_profiles.capacity_kg` required before claiming | Whole-listing claim must fit declared per-claim capacity; this is not a full inventory-capacity model. |
| Zone implicit through donor account | Snapshot `food_listings.zone_id` on creation | Changing a user profile must not move historical listings or impact between zones. |
| Time trigger fires only on UPDATE | Live-query checks + minute worker + write guard | Time passing alone fires no row trigger. Claim checks use current database time after lock acquisition. |
| Status list has no delivered state | Add `Delivered`; add claim `Completed`/`Expired` | Model actual completion and terminal history without reopening uniqueness for completed allocations. |
| Confirmed-only unique index | Unique listing index for `Confirmed` and `Completed` claims | Historical cancellation can allow a replacement claim, but a completed listing cannot be allocated again. |
| Ratings vs all parties | Donor <-> receiver ratings after delivery; volunteer ratings deferred | Resolves 'both parties' without introducing an unbounded reputation model. |
| Pickup weak entity vs diagram 1:1 | Many attempts per claim, one active or delivered pickup | Preserve composite key and missed-attempt history. |
| Chain links but no payload or concurrency rule | Per-user sequence, JSON payload, canonical SHA-256, serialized append | Prevents forks and permits independent verification. Global blockchain/network consensus is out of scope. |
| Push/SMS FR vs later SMS roadmap | Durable in-app notifications first; provider adapter in P09 | External-channel FR remains partial until a real channel is configured/tested; no mock delivery claims. |
| RLS described as hiding password hashes | RLS for row scope; restricted projection and response models for columns | Row policies alone cannot redact columns. |
| Raw actor/zone settings can be forged by runtime SQL | Resolve actor from a private session-hash table; fixed-path definer helpers owned by NOLOGIN guard | Runtime cannot read sessions or mint them. P03 auth routines establish opaque session credentials; transaction-local context prevents pool leakage. |

## Later authorization decision

An active, approved zone Admin may grant Admin access to an active member in the
same zone. The grant requires a reason and appends a trust-ledger event. This route
approves only the Admin role; public registration and public role verification remain
separate.
| PickedUp implies redistributed | Show picked-up kg and delivered kg separately | Preserve source report while avoiding 'meals served' claims for undelivered food. |
| Zone partitions imply outage isolation | Logical zone scoping in one DB; physical isolation deferred | Shared DB is a shared availability dependency. Do not promise independent-zone uptime. |
| Listing edit/cancel after claim unspecified | Only available listings editable; claimed cancellations use explicit coordinated transaction | Prevent quantity/location/safety window changes beneath an accepted claim. |
| Expiry after pickup unspecified | Scheduled pickups block after expiry; picked-up food may complete until expiry; overdue delivery is failed | No successful delivery after donor deadline in the prototype. Donor-supplied deadline is not a safety guarantee. |

## Scope decisions

Whole-listing claims only. Default matching radius 5 km, configurable per deployment
and capped at 25 km for API requests. Only verified, same-zone roles act on a listing.
No self-claim. No automatic admin role assignment. No payments, bidding, partial
inventory, route optimization, public personal-location feeds, blockchain deployment,
physical database sharding, or external provider charges in the core prototype.

These decisions can change with an explicit requirement or recorded stakeholder
evidence. Amend this record (or add a superseding ADR), then update schema, contract,
fixtures, requirements and tests in the same change.

## Technical references

- [PostgreSQL row locking](https://www.postgresql.org/docs/17/explicit-locking.html).
- [PostgreSQL partial indexes](https://www.postgresql.org/docs/17/indexes-partial.html).
- [PostGIS distance filtering](https://postgis.net/docs/ST_DWithin.html).
- [PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
- [PostGIS Docker image](https://github.com/postgis/docker-postgis).

## Donor reliability extension

Use the existing worker/outbox instead of provisioning new queues or notification
services. An optional Twilio adapter supports one consenting demo number with an
atomic daily attempt cap (default three, maximum ten) and provider receipt polling.
An uncertain network send fails without automatic resend, trading demo reliability
for duplicate-charge avoidance. Real external evidence remains a separate release gate.

Recurring donations are daily templates/reminders with fresh donor publication.
Scheduling cannot establish future food availability or ingredient/handling truth.
The PWA stores only public static assets and an offline guidance page; private API
responses and food mutations remain online-only. Pilot notes require actual consenting
participants; prepared questions cannot substitute for interviews.
