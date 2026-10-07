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

## Community needs, pickup agreements and zone updates

All these routes require an authenticated session and derive the member's zone
from the session. Reads are private/no-store. Writes require CSRF and
`Idempotency-Key`; guarded database routines repeat authorization and persist
ledger and inbox events in the same transaction.

| Method / path | Input | Authorization / result |
| --- | --- | --- |
| GET `/requests` | status, mine, q, cursor, limit | Signed-in same-zone member; expired and fulfilled states are derived at read time |
| POST `/requests` | food_type, category, quantity_kg, needed_by, note | Approved Receiver; creates a zone request |
| GET `/requests/{id}` | none | Same-zone member; request plus linked listing offers, never another zone |
| POST `/requests/{id}/offers` | listing_id | Approved owner Donor; links one live same-zone listing; standard claim rules remain authoritative |
| POST `/requests/{id}/close` | reason | Request owner or same-zone Admin; records the close reason |
| POST `/claims/{id}/pickups/{pickup_id}/schedule` | current version; optional scheduled_time | Assigned Donor, Receiver or Volunteer; accept current proposal or counter-propose, incrementing version |
| GET `/community/updates` | cursor, limit | Any authenticated same-zone member, including pending members; published, unexpired updates only |
| POST `/community/suggestions` | kind, title, body, optional HTTPS link, ends_at | Approved community member; submits a suggestion for zone-admin review |
| GET `/community/suggestions/mine` | cursor, limit | Authenticated member; own suggestions only |
| GET `/admin/community/suggestions` | status, cursor, limit | Same-zone Admin; review queue |
| POST `/admin/community/suggestions/{id}/publish` | empty object | Same-zone Admin; publishes a pending, unexpired suggestion |
| POST `/admin/community/suggestions/{id}/reject` | reason | Same-zone Admin; records rejection reason |
| POST `/admin/community/updates` | kind, title, body, optional HTTPS link, ends_at | Same-zone Admin; publishes an announcement or curated partner resource |
| POST `/admin/community/updates/{id}/archive` | empty object | Same-zone Admin; removes an update from member reads |

Pickup agreement is versioned: a new proposal starts a fresh agreement; the
proposer is counted as accepting, and the other two participants must accept
that exact version before collection. A version mismatch returns 409
`STALE_PROPOSAL`; collection before all three confirmations returns 409
`SCHEDULE_UNCONFIRMED`. Food requests close by owner/admin action, expiry, or when
fully delivered linked listing quantities meet the target. Listings are never
split to satisfy a request.

## Inbox, ledger and reports

| Method / path | Input | Authorization / result |
| --- | --- | --- |
| GET `/settings/notifications` | none | Own SMS/push choices and provider availability |
| PATCH `/settings/notifications` | `sms_enabled`, `push_enabled` | Own preferences; CSRF protected |
| GET `/notifications` | unread_only, cursor | Self inbox only |
| POST `/notifications/{id}/read` | empty object; Idempotency-Key | Owner; idempotent read_at assignment; only first read changes the ledger |
| POST `/notifications/clear` | empty object | Hides own inbox entries while preserving audit records |
| POST `/listings/{id}/hide-cancelled` | empty object | Donor hides own cancelled listing from `/listings/mine` |
| POST `/admin/users/{id}/admin` | required `reason` | Active same-zone Admin grants Admin; public roles remain separate |
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

## Conditional overview and full-chain verification

`GET /api/v1/workspace/overview` returns an actor-scoped `ETag`. An authenticated
request with the same `If-None-Match` returns 304 without a body when its data is
unchanged; server-time-only changes do not invalidate it. The client keeps its
response only in account-scoped memory; `Cache-Control: private, no-store` remains.
Authentication and database counts run again for every request.

`GET /api/v1/trust-ledger/mine/verification` returns `data.valid`,
`entries_verified`, `head_hash`, `checked_through_sequence`, and `assurance`. It
checks the signed-in member's complete stored chain with the independent Python
canonicalizer, not just the displayed page. Invalid chains return `valid: false`.
This is internal consistency evidence; it does not verify an external checkpoint
or prove that a database owner has never rewritten the chain.


## UI discovery extensions (revision 0005 release)

- GET `/listings` adds optional `include_over_capacity` (false by default). The
  capacity flag is included in feed cursor scope. `meta.hidden_over_capacity_count`
  counts all larger live listings matching the same zone, donor eligibility,
  saved-profile allocation distance, requested radius, category and literal name
  search, independently of pagination. Explicitly included larger rows remain
  ineligible for claims; the guarded claim command is unchanged.
- Listing projections add `donor_verified`, `donor_rating_avg` (nullable),
  `donor_rating_count`, `claim_eligible`, `claim_ineligible_reason`, and `has_photo`.
  Ratings use the existing sealed safe `dbthon_trust` aggregate so they match the
  trust endpoint even when direct rating-row RLS limits visible participants.
  No donor contacts or account coordinates enter this projection.
- POST/PATCH listing bodies accept optional `photo_base64`, at most 204800 base64
  characters representing at most 153600 image bytes. Omission keeps a photo;
  null removes it. Invalid photos roll back the entire create/edit transaction.
- GET `/listings/{id}/photo` requires verified same-zone access and returns a
  metadata-free JPEG with private/no-store and nosniff headers; absent/invisible
  photos return 404. POST `/admin/listings/{id}/photo/remove` accepts `{}` with
  CSRF and Idempotency-Key and records the moderation action in affected ledgers.
- GET `/public/impact` is unauthenticated and returns only non-identifying totals.
  `includes_demo_data` flags a database containing imported synthetic fixtures;
  estimates and prototype provenance remain explicit in the homepage.
- Impact rows and CSV add `median_claim_latency_seconds`, `expired_kg`, and
  `cancelled_listing_kg`. Delivered/expired/cancelled chart series use these exact
  rows. Expired quantities are attributed to their deadline; cancelled listings
  to updated_at. `summary` supplies an exact overall median and expiry rate for
  listings created in the selected interval, evaluated at current server time.
  Daily medians are never averaged to construct the overall median.
- Overview 304 responses include `X-Server-Time`; CORS exposes it so cache hits
  retain current server-anchored countdowns without changing content ETags.
