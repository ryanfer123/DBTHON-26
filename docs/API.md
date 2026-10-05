# Implemented REST API contract

Base path `/api/v1`. All paths below are implemented; the generated contract is
[openapi.json](openapi.json). Authenticated responses are private/no-store.
Identity request headers, envelopes and session policy: [IDENTITY.md](IDENTITY.md).
IDs are integers; mass is a decimal string in kg; distance is metres; timestamps are
RFC3339 UTC strings. Session auth and CSRF behavior: [architecture](ARCHITECTURE.md).
All endpoints validate approved roles, zone and object ownership server-side.

## Response conventions

- Resource response: `{"data": {...}, "meta": {"server_time": "..."}}`.
- List response: `{"data": [...], "meta": {"server_time": "...", "next_cursor": null}}`.
- Error: `{"error": {"code": "LISTING_UNAVAILABLE", "message": "...", "details": {}}, "request_id": "..."}`.
- Page limit default 20, maximum 100. Cursor includes stable ordering keys; do not
  use an unbounded list. Feeds include per-result distance and remaining seconds.
- 400 malformed request; 401 unauthenticated; 403 failed role/verification; 404 missing
  or object outside authorized scope; 409 competing state/idempotency conflict;
  422 field validation; 503 temporary database/lock timeout with retry advice.
- Critical writes require `Idempotency-Key` (opaque 8-128 character string).
  Same actor/operation/key + same body returns original status/body; reuse with a
  different body returns 409 `IDEMPOTENCY_CONFLICT`. Retain records for at least 24 h.
  Recheck authentication on replay, and deny if current actor access has been revoked.
- Accept explicit action commands rather than arbitrary status PATCH values.
- `make openapi` regenerates the exported FastAPI contract; `--check` detects drift.
- Every workflow write requires Idempotency-Key, including listing edits, ratings and
  inbox reads. Command responses contain IDs/status in `data`; follow with a resource GET.
- Listing feed cursors are opaque, filter-bound strings. Own-listing/claim/inbox/ledger
  cursors are increasing IDs/sequences; volunteer history uses `claim_id:pickup_id`.
- Matching is bounded to 5 km around the saved profile. Optional feed coordinates
  further narrow discovery; they do not move eligibility.

## Identity and administration

| Method / path | Input | Authorization / result |
| --- | --- | --- |
| GET `/health/live` | none | Public process health; no sensitive dependency details |
| GET `/health/ready` | none | Database readiness; 503 when unavailable |
| GET `/community` | none | Public role descriptions for the welcome screen; implemented in P01 |
| GET `/zones` | city optional, pagination | Public zone names/city only |
| POST `/auth/register` | name, email, phone, password, roles (Donor/Receiver/Volunteer), zone_id, latitude, longitude, capacity_kg if Receiver | 201 unverified user; never accept approved/admin flags |
| POST `/auth/login` | email, password | 200 safe user DTO + Set-Cookie session; rate-limit failures |
| POST `/auth/logout` | CSRF token | 204 revoke session and clear cookie |
| GET `/auth/me` | session cookie | `data.user` self profile + `data.csrf_token`; private/no-store |
| GET `/auth/session` | optional session cookie | UI session snapshot; same safe DTO/CSRF for active sessions, `data: null` for anonymous/malformed/expired/revoked/inactive sessions; private/no-store; database failure remains 503 |
| PATCH `/auth/me` | name, phone, latitude, longitude, capacity_kg | Self; zone/role changes require verification workflow; ledger event |
| GET `/admin/users` | zone_id, verification filter, cursor | Approved zone Admin only |
| POST `/admin/users/{id}/verify` | requested public roles to approve, verified boolean, reason | Scoped Admin; replace public-role approvals; revocation uses empty roles; 200 safe profile; no Admin grants |

## Workspace overview

Authenticated `GET /workspace/overview` is available to pending members and uses
the existing restricted runtime connection/RLS. No new grants or migration.
`meta.server_time` is authoritative. `data` contains current approved `capabilities`,
exact delivered/unread `unread_count`, permitted `summaries`, `upcoming` and
`updates`. Summaries are omitted for inapplicable roles:

- Donor: `live_donations`, owned Available listings whose deadline is after server time.
- Donor/Receiver: `active_exchanges`, Confirmed participating claims.
- Volunteer: `active_deliveries`, own Scheduled or PickedUp assignments.
- Admin: `pending_reviews`, unverified members in the administrator's own zone.

Counts query the database independently of paginated lists. Upcoming exchanges
and deliveries are limited to five total, ordered by collection deadline then
claim/kind/pickup ID. Updates are the five newest delivered unread notifications.
No participant contacts are returned. Revoked approvals suppress role summaries.

## Listings and matching

| Method / path | Input | Authorization / result |
| --- | --- | --- |
| POST `/listings` | food_type, category, quantity_kg, prepared_at, expiry_window_start/end, pickup_lat/long | Verified Donor; derive donor_id/zone_id from session; 201 command result with listing ID |
| PATCH `/listings/{id}` | allowed food/quantity/time/location changes | Owning Donor, Available only; 200 command result with listing ID |
| POST `/listings/{id}/cancel` | reason; Idempotency-Key | Owning Donor, before actual pickup; 200 terminal listing/related cancellation |
| GET `/listings` | latitude, longitude, radius_m, category optional, q optional, cursor | Verified Receiver; ranked live capacity-filtered feed in own zone |
| GET `/listings/mine` | status filter, q optional, cursor | Donor's own history including terminal listings |
| GET `/listings/{id}` | none | Eligible zone viewer or transaction participant; safe donor projection |
| POST `/listings/{id}/claims` | empty object; Idempotency-Key | Verified eligible Receiver; 201 confirmed claim; 409 if allocation lost |

Optional food-name `q` is limited to 80 characters, trimmed and matched
case-insensitively as a literal substring using parameterized SQL. `%`, `_` and
backslash are escaped rather than treated as wildcard syntax. The feed cursor
binds the normalized search along with its other filters; changing search while
reusing a feed cursor returns validation failure. UI filter changes reset cursors.

Create-listing request example (times must be replaced with live eligible values):

```json
{
  "food_type": "Cooked rice and vegetables",
  "category": "Veg",
  "quantity_kg": "8.00",
  "prepared_at": "2026-10-05T09:00:00Z",
  "expiry_window_start": "2026-10-05T09:30:00Z",
  "expiry_window_end": "2026-10-05T12:30:00Z",
  "pickup_lat": 12.9692,
  "pickup_long": 79.1559
}
```

## Claims, volunteer attempts and ratings

| Method / path | Input | Authorization / result |
| --- | --- | --- |
| GET `/claims/mine` | status filter, cursor | Receiver claims or donor's listing claims; explicit role context |
| GET `/claims/{id}` | none | Donor/receiver/assigned volunteer or approved scoped Admin |
| POST `/claims/{id}/cancel` | reason; Idempotency-Key | Receiver before actual pickup; coordinated cancellation |
| GET `/pickup-tasks` | radius_m, cursor | Verified Volunteer; unassigned eligible same-zone claims |
| POST `/claims/{id}/pickups` | scheduled_time; Idempotency-Key | Eligible Volunteer; 201 Scheduled attempt; one winner |
| GET `/pickups/mine` | status filter, cursor | Volunteer's assigned attempts |
| POST `/claims/{id}/pickups/{pickup_id}/cancel` | reason; Idempotency-Key | Assigned Volunteer, Scheduled only |
| POST `/claims/{id}/pickups/{pickup_id}/picked-up` | empty object; Idempotency-Key | Assigned Volunteer; server timestamp; deadline check |
| POST `/claims/{id}/pickups/{pickup_id}/delivered` | empty object; Idempotency-Key | Assigned Volunteer; server timestamp; atomically complete allocation |
| GET `/admin/claims` | status, cursor | Scoped Admin exchange history |
| POST `/admin/claims/{id}/fail` | reason; Idempotency-Key | Scoped Admin; terminal failure/dispute; no automatic relisting |
| POST `/claims/{id}/ratings` | target_user_id, score, comments optional; Idempotency-Key | Completed donor/receiver participant; 201 rating and recalculated trust |

Both claim_id and pickup_id are needed to address a pickup. Do not simplify the
weak entity's composite key away in route handlers or frontend state.

## Inbox, ledger and reports

| Method / path | Input | Authorization / result |
| --- | --- | --- |
| GET `/notifications` | unread_only, cursor | Self inbox only |
| POST `/notifications/{id}/read` | empty object; Idempotency-Key | Owner; idempotent read_at assignment; only first read changes the ledger |
| GET `/users/{id}/trust` | none | Safe average/count for permitted visible profile |
| GET `/trust-ledger/mine` | cursor | Own chain, redacted canonical event payload |
| GET `/admin/users/{id}/trust-ledger` | cursor | Scoped Admin audit |
| GET `/admin/impact` | from, to, zone_id or city, grouping day/zone/city | Admin approved zones; consistent documented aggregates |
| GET `/admin/impact/export` | same filters; CSV response | Same authorization and semantics as dashboard |

Impact response contains `picked_up_kg`, `delivered_kg`, `estimated_meals`,
`estimated_co2e_kg` (nullable), `claim_latency_seconds`, counts, and a `factors`
object with meal weight, emissions factor/source/version and reporting timezone.
Enforce a bounded reporting window (default 7 days, maximum 366 days).

## Race and error examples

Two receivers claim one listing: one gets 201 and one gets 409 with code
`LISTING_UNAVAILABLE`; only one active allocation exists. A retry by the winning
receiver with the same key/body returns the original 201 and same claim ID.
At the exact deadline return 409 `LISTING_EXPIRED`. At insufficient declared
capacity return 409 `CAPACITY_INSUFFICIENT`. Unverified approved-role absence
returns 403 `VERIFICATION_REQUIRED`. An invisible zone/object returns 404 rather
than leaking another zone's identity or transaction details.
