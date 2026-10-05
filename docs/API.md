# REST API contract to implement

Base path `/api/v1`. Most of this is a target contract. P01 implements the two health
endpoints and public `GET /community` introduction. P03 implements all identity and
administration routes in the first table; listing/delivery/report routes remain
targets. Actual generated contract: [openapi.json](openapi.json).
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
- Generate FastAPI OpenAPI after routes exist; commit a reviewed export and compare
  it to this contract. This Markdown specification is not an existing OpenAPI artifact.

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
| PATCH `/auth/me` | name, phone, latitude, longitude, capacity_kg | Self; zone/role changes require verification workflow; ledger event |
| GET `/admin/users` | zone_id, verification filter, cursor | Approved zone Admin only |
| POST `/admin/users/{id}/verify` | requested public roles to approve, verified boolean, reason | Scoped Admin; replace public-role approvals; revocation uses empty roles; 200 safe profile; no Admin grants |

## Listings and matching

| Method / path | Input | Authorization / result |
| --- | --- | --- |
| POST `/listings` | food_type, category, quantity_kg, prepared_at, expiry_window_start/end, pickup_lat/long | Verified Donor; derive donor_id/zone_id from session; 201 listing |
| PATCH `/listings/{id}` | allowed food/quantity/time/location changes | Owning Donor, Available only; 200 listing |
| POST `/listings/{id}/cancel` | reason; Idempotency-Key | Owning Donor, before actual pickup; 200 terminal listing/related cancellation |
| GET `/listings` | latitude, longitude, radius_m, category optional, cursor | Verified Receiver; ranked live capacity-filtered feed in own zone |
| GET `/listings/mine` | status filter, cursor | Donor's own history including terminal listings |
| GET `/listings/{id}` | none | Eligible zone viewer or transaction participant; safe donor projection |
| POST `/listings/{id}/claims` | empty object; Idempotency-Key | Verified eligible Receiver; 201 confirmed claim; 409 if allocation lost |

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
| GET `/pickup-tasks` | latitude, longitude, radius_m, cursor | Verified Volunteer; unassigned eligible same-zone claims |
| POST `/claims/{id}/pickups` | scheduled_time; Idempotency-Key | Eligible Volunteer; 201 Scheduled attempt; one winner |
| GET `/pickups/mine` | status filter, cursor | Volunteer's assigned attempts |
| POST `/claims/{id}/pickups/{pickup_id}/cancel` | reason; Idempotency-Key | Assigned Volunteer, Scheduled only |
| POST `/claims/{id}/pickups/{pickup_id}/picked-up` | empty object; Idempotency-Key | Assigned Volunteer; server timestamp; deadline check |
| POST `/claims/{id}/pickups/{pickup_id}/delivered` | empty object; Idempotency-Key | Assigned Volunteer; server timestamp; atomically complete allocation |
| POST `/admin/claims/{id}/fail` | reason; Idempotency-Key | Scoped Admin; terminal failure/dispute; no automatic relisting |
| POST `/claims/{id}/ratings` | target_user_id, score, comments optional; Idempotency-Key | Completed donor/receiver participant; 201 rating and recalculated trust |

Both claim_id and pickup_id are needed to address a pickup. Do not simplify the
weak entity's composite key away in route handlers or frontend state.

## Inbox, ledger and reports

| Method / path | Input | Authorization / result |
| --- | --- | --- |
| GET `/notifications` | unread_only, cursor | Self inbox only |
| POST `/notifications/{id}/read` | empty object | Owner; idempotent read_at assignment |
| GET `/users/{id}/trust` | none | Safe average/count for permitted visible profile |
| GET `/trust-ledger/mine` | cursor | Own chain, redacted canonical event payload |
| GET `/admin/users/{id}/trust-ledger` | cursor | Scoped Admin audit |
| GET `/admin/impact` | from, to, zone_id or city, grouping day/zone/city | Admin approved zones; consistent documented aggregates |
| GET `/admin/impact/export` | same filters, format=csv | Same authorization and semantics as dashboard |

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
