# Domain rules and edge cases

These are implementation defaults derived from the brief and ADR 0001. A donor's
deadline is supplied data, not a system guarantee that food is safe. Show prepared
time, category, quantity and deadline clearly; do not invent automatic safety windows.

## Eligibility and matching

Require active, verified actors with an approved role and a matching zone. Receiver
cannot equal donor. A Receiver role also needs a positive declared per-claim capacity.
Volunteer cannot be the donor or receiver on the same claim in the first prototype.
Admin is zone-scoped; no implicit global admin through user registration.

Candidate feed eligibility: `Available`, `expiry_window_start <= clock_timestamp()`,
`expiry_window_end > clock_timestamp()`, same zone, distance within radius, quantity
<= receiver capacity, donor active/verified. Use geography ST_DWithin in metres;
calculate exact distance on the filtered candidates. Default radius 5,000 m, maximum
25,000 m. Rank `expiry_window_end ASC`, then `distance_m ASC`, then `listing_id ASC`.
This reproducible lexicographic rule resolves the unspecified ranking weights.
Volunteer task matching uses confirmed claim, deadline and same-zone proximity.

Return server time, distance and seconds remaining. A frontend countdown is advisory;
only server checks authorize actions. Warn at <=1,800 seconds. A stale open tab must
handle 409 conflict and refresh the listing.

## Listing lifecycle

```mermaid
stateDiagram-v2
    [*] --> Available
    Available --> Claimed: eligible receiver claim
    Available --> Cancelled: donor cancel
    Available --> Expired: deadline
    Claimed --> Available: receiver cancellation before pickup and deadline
    Claimed --> Cancelled: donor cancellation before pickup
    Claimed --> PickedUp: accepted volunteer pickup
    Claimed --> Expired: deadline before pickup
    PickedUp --> Delivered: delivery before deadline
    PickedUp --> Expired: overdue or failed delivery
    Delivered --> [*]
    Expired --> [*]
    Cancelled --> [*]
```

Available edits require ownership and valid time/quantity data; any change can rerank
the feed and must create audit/notification events. Do not change donor/zone IDs.
Claimed listings cannot be edited. Expired, cancelled and delivered records are immutable.

## Claim lifecycle and cancellation

Successful claim creates `Confirmed` synchronously and changes listing to `Claimed`.
No placeholder Pending row is necessary. Completed delivery changes claim to
`Completed`; deadline expiry changes active claim to `Expired`; explicit permitted
cancellation changes it to `Cancelled`. Keep prior cancelled/expired rows.

Receiver may cancel only before actual pickup. Under listing/claim/attempt locks,
cancel any scheduled attempt and the claim; return listing to Available only if the
window remains open, else Expired. Donor cancellation before pickup terminates the
claim and scheduled attempt and sets Cancelled. Neither party silently releases food
already picked up. Admin can record a failed delivery/dispute with reason, without
relisting it. Partial claims and splitting are deferred.

## Pickup lifecycle

Confirmed claims expose an unassigned task. A verified volunteer accepts and creates
a Scheduled attempt with scheduled_time between current time and expiry. Competing
accepts lock the same listing/claim and only one succeeds. Pickup changes attempt to
PickedUp and records actual_pickup_time. Delivery changes it to Delivered with
delivery_time and completes listing/claim in the same transaction. Required ordering:
claimed_at <= actual_pickup_time <= delivery_time < expiry_window_end.

Scheduled attempt can be cancelled by its volunteer before pickup; claim remains
Confirmed and task reopens if time permits. A scheduled attempt not picked up within
a configurable 15-minute grace is Missed, allowing a replacement attempt while the
claim remains valid. At expiry, scheduled attempts become Missed, active claims and
listings become Expired. A PickedUp attempt passing expiry becomes Failed and claim/
listing Expired. Preserve actual pickup time and failure reason; do not count it as
delivered. Recheck these conditions inside every command regardless of worker timing.

## Ratings and reputation

Only the donor and receiver on a Completed claim may rate each other, once per
direction, score 1-5, maximum 300 comment characters. No self/volunteer/stranger
rating in the initial scope. Return average received score and count; no rating means
null average, count zero, not a misleading zero trust score. Verification and ratings
are different concepts. Ratings create events for both affected user chains.

## Notifications and retries

Commit inbox/outbox rows with the domain event; worker delivers after commit. Match
creation recipients by the same eligibility logic as the feed. Status-change alerts
go to affected participants. Unique event/user/channel keys prevent duplicate local
entries. Worker leases Processing rows and retries expired leases after crashes.
Use bounded exponential backoff and a dead-letter state after documented maximum
attempts. External providers can redeliver; use provider idempotency when available,
otherwise promise at-least-once transport rather than exactly-once SMS.
Do not mark Sent for an adapter that only logged a message. In-app delivery and
external delivery statuses are distinct.

## Impact definitions

Date range is half-open `[from,to)` in UTC; frontend labels local timezone.

| Metric | Definition |
| --- | --- |
| Listings created | Distinct listings created in range, grouped by immutable listing zone |
| Confirmed claims | Distinct successful claim confirmations in range, including those subsequently Completed; show later cancellations separately |
| Picked-up kg (source metric) | Sum one full quantity per listing with actual pickup in range, including later failures, explicitly labelled picked up |
| Delivered kg | Sum one quantity per listing with successful delivery in range; retry joins cannot duplicate it |
| Estimated meals-equivalent | Delivered kg / configured 0.4 kg per meal; display estimate and factor; source picked-up equivalent can be a separate labelled column |
| Estimated CO2e avoided | Delivered kg * configured kgCO2e/kg; null plus missing-factor note until a supported factor is supplied |
| Participation | Distinct active donors/receivers/volunteers involved in events in range; multi-role people count once within each role |
| Average time-to-claim | Average successful claimed_at-created_at in seconds; report sample count and chosen range on claimed_at |

Do not present meal-equivalent as observed meals served or estimates as measured
environmental savings. Record factor version/source alongside exported reports.
