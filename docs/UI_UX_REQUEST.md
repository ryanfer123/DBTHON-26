Second Table — UI/UX Improvement Plan

A prioritised, implementation-ready plan from two viewpoints: a senior UI developer (code quality, performance, consistency) and a customer (donor, receiver, volunteer, admin).

Scope of this review: static review of the React app (apps/web/src), styles.css, the docs in docs/, the concept images in docs/design/, and the original PDF. The app was not run, so items are marked with how they were verified. Nothing here changes the database guarantees; backend work is called out explicitly where needed.

Contents
Summary & priorities
What is already good (keep it)
Phase 1 — Quick fixes (≈ 1 day)
Phase 2 — Core experience (≈ 3–4 days)
Phase 3 — Trust & delight (≈ 3–4 days)
Code health & performance
Role-by-role customer journeys
Expo / demo plan
Testing additions
How to measure that it worked
Explicitly out of scope
Correction to the earlier verbal review
1. Summary & priorities

The product's hard problem is speed and trust at the moment of decision: a donor must list in seconds, a receiver must decide claim or not in seconds, and everyone must believe the other side is real. The current UI is clean and accessible but is built like a records system (forms, lists, raw numbers). The plan converts it into a time-critical tool.

#	Improvement	Persona	Effort	Impact	Backend change?
1	Human-readable countdown (2 h 15 min)	Receiver, Volunteer	S	High	No
2	Urgency not by colour alone ("Ending soon" badge + icon)	Receiver	S	High	No
3	Compress/serve hero image (2.2 MB PNG)	Everyone	S	High	No
4	"Updated 12 s ago" instead of manual Refresh buttons	Everyone	S	Medium	No
5	Skeleton loaders	Everyone	S	Medium	No
6	Donor listing presets ("good for 2 h / 4 h / 6 h") + "list again"	Donor	M	Very high	No
7	Map picker for pickup point & location (coordinates hidden)	Donor, Receiver	M	High	No
8	Receiver feed: List ⇄ Map toggle	Receiver	M	Very high	No
9	Capacity transparency ("3 larger listings hidden")	Receiver	S	Medium	Small
10	Donor trust on the listing (Verified + rating)	Receiver	M	Very high	Small
11	Post-claim "what happens next" screen	Receiver	S	High	No
12	Volunteer one-tap Directions / Call	Volunteer	S	High	No
13	Live impact strip on home	Visitors, judges	S	Medium	Small
14	Admin impact charts	Admin, judges	M	High	No
15	Listing photo (optional)	Donor, Receiver	L	High	Yes (migration)
16	Honest notification status in the UI	Everyone	S	Medium	No

Effort: S ≤ half a day · M ≈ 1–1.5 days · L ≈ 2+ days.

2. What is already good (keep it)

Do not regress these when changing things:

Semantic, labelled forms; focus-trapped <dialog> mobile menus; aria-busy, role="status"/alert.
Filters persisted in the URL; breadcrumbs that preserve the originating list; deep links survive refresh.
Server-time-based countdown (clients can't cheat with a wrong clock).
Dark mode via tokens; consistent forest/sage palette; plain-language copy ("Share some food").
Buttons disabled while a command is in flight; no optimistic claim success.
A usable empty state for most lists.
3. Phase 1 — Quick fixes (≈ 1 day)
3.1 Human-readable countdown

Problem — Countdown in features/workflows/Workspace.tsx renders Math.ceil(remaining / 60) min remaining, so a 5-hour window reads "300 min remaining". The concept image (docs/design/workspace-concept.png) shows "1 h 45 min remaining", so the build is behind its own design. (Verified in code.)

Proposal — one shared formatter, used by Countdown, dashboard and detail page.

ts
// features/workflows/time.ts
export function formatRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'Deadline reached'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (totalSeconds < 300) return `${m} min ${totalSeconds % 60} s left`
  if (h === 0) return `${Math.max(1, m)} min left`
  return m === 0 ? `${h} h left` : `${h} h ${m} min left`
}

Acceptance

10 800 s → "3 h left"; 6 300 s → "1 h 45 min left"; 90 s → "1 min 30 s left"; 0 → "Deadline reached".
Unit test for each boundary (0, 299, 300, 3 599, 3 600).
Screen-reader text updates at most once per minute (avoid per-second announcements; keep the visual tick).
3.2 Urgency must not rely on colour alone

Problem — .countdown.urgent only changes color (
#a25818, dark
#f0b36e); the text is identical. docs/UX.md says "Do not encode expiry/status by colour alone." (Verified in CSS.) The API already returns approaching_expiry and seconds_remaining on every listing.

Proposal — a badge with icon and words, and sort emphasis.

tsx
export function Urgency({ seconds, approaching }: { seconds: number; approaching: boolean }) {
  if (seconds <= 0) return <span className="badge badge-expired">Expired</span>
  if (approaching) return <span className="badge badge-urgent"><ClockIcon aria-hidden /> Ending soon</span>
  return null
}

Acceptance

"Ending soon" is present in the DOM text, not only in CSS.
Colour contrast ≥ 4.5:1 in light and dark themes.
Add a Playwright assertion: a listing with < 30 min shows the "Ending soon" text.
3.3 Hero image: 2.2 MB PNG

Problem — public/images/food-handover.png is 2 239 875 bytes and is the LCP element on the homepage (fetchPriority="high"). Poor on campus Wi-Fi/mobile data. (Verified: file size.)

Proposal

sh
# one-off, from apps/web/public/images
cwebp -q 78 food-handover.png -o food-handover-1448.webp
cwebp -q 76 -resize 900 675 food-handover.png -o food-handover-900.webp
cwebp -q 74 -resize 480 360 food-handover.png -o food-handover-480.webp
tsx
<img className="hero-photo" src="/images/food-handover-900.webp"
  srcSet="/images/food-handover-480.webp 480w, /images/food-handover-900.webp 900w, /images/food-handover-1448.webp 1448w"
  sizes="(max-width: 800px) 100vw, 50vw" width="1448" height="1086" fetchPriority="high" alt="…" />

Acceptance — hero ≤ 150 KB on mobile, ≤ 300 KB on desktop; no layout shift (keep width/height); Lighthouse LCP < 2.5 s on a throttled "Fast 3G" profile.

3.4 Replace manual Refresh with a freshness indicator

Problem — "Refresh food" and "Refresh dashboard" are text buttons even though the overview polls every 15 s (docs/UX.md). Users can't tell whether data is stale.

Proposal — show Updated 12 s ago (live-updating text) with a small refresh icon button kept for explicit control; when new listings arrive, show a non-intrusive "2 new listings" pill that inserts them on click (avoids rows jumping under the cursor mid-claim).

Acceptance — freshness text updates every ~10 s; failure shows "Couldn't update — Retry" without clearing the existing list; no layout jump when data refreshes.

3.5 Skeleton loaders

Problem — QueryStatus shows only "Loading your community…". No skeleton styles exist. (Verified by grep.)

Proposal — a <ListSkeleton rows={4}/> matching .food-row's grid so content doesn't shift; keep role="status" with visually-hidden "Loading". Respect prefers-reduced-motion (no shimmer animation, static grey blocks).

3.6 Honest notification status

Problem — SMS/push are not implemented (README/STATUS). The UI shouldn't suggest otherwise.

Proposal — on registration and in the inbox: "Updates appear here in your inbox. SMS and push alerts are not enabled yet." Add one line to Help.

4. Phase 2 — Core experience (≈ 3–4 days)
4.1 Donor: list in under 30 seconds

Problem — The listing form (ListingForm in FoodPages.tsx) requires food name, category, quantity, three datetime-local fields (prepared, collection opens, collect by) and latitude/longitude. For a busy kitchen this is the single biggest drop-off risk.

Proposal

Duration chips replace manual date-times for the common case: Ready now · good for [1 h] [2 h] [4 h] [6 h] [Custom]. Default: prepared = now, opens = now, ends = now + chip. "Custom" reveals the existing three fields (keeps full flexibility and current validation).
Quantity helper — Whole quantity (kg) with quick steps (±0.5) and a hint "about N meals" (kg ÷ 0.4, the project's meal factor).
"List again" — on a donor's previous listing, a button that prefills food name, category, quantity and location with fresh times.
Remember last pickup point — default to the previous listing's location, then profile location.
Preview card — right-hand (desktop) / bottom (mobile) live preview of how receivers will see it (name, kg, "Collect by 7:30 pm", urgency).
tsx
const PRESETS = [1, 2, 4, 6] // hours
function windowFor(hours: number, now = new Date()) {
  const end = new Date(now.getTime() + hours * 3_600_000)
  return { prepared_at: now, start: now, end }
}

Guardrail — the system must still not invent food-safety windows (docs/DOMAIN_RULES.md). Label the chips "Collect within…" and keep the existing line: "Deadlines are provided by donors." The server still enforces end-in-future and ≤ 7 days.

Acceptance

A returning donor can publish a repeat listing in ≤ 3 interactions.
A new donor can publish with only: name, quantity, one chip, confirm location.
Existing validation and error messages still appear for Custom times.
E2E: preset flow creates a listing whose expiry_window_end - now equals the chosen preset ± 1 minute.
4.2 Map picker instead of raw coordinates

Problem — LocationFields (features/identity/FormParts.tsx) shows two numeric inputs plus a "use my location" button (geolocation already exists — keep it). Listing detail shows <Coordinates> as 12.9716, 79.1587. Nobody reasons in coordinates. (Verified in code.)

Proposal

A small map (Leaflet + OpenStreetMap tiles; free) with a draggable pin; lat/long fields move into an "Advanced" disclosure and stay in sync.
Detail page: replace raw coordinates with a static mini-map + "Open in Maps" link + "Copy coordinates".
Fallbacks (required by docs/UX.md): if tiles fail or JS map is blocked, show the existing coordinate inputs and an accessible text description. Always include a text alternative.

Constraints to respect

docs/ARCHITECTURE.md says no paid map services — OSM tiles are free, but follow the tile usage policy (attribution, no bulk prefetch). For the Expo, a self-hosted or provider-keyed tile source is safer if many judges load it at once.
Privacy: only render donor pickup points and the viewer's own location. Never plot other receivers' or volunteers' coordinates.
Bundle size: lazy-load the map (React.lazy) so the homepage and forms without maps don't pay for it.

Acceptance — dragging the pin updates both fields; typing coordinates moves the pin; works keyboard-only (fields remain the accessible path); map chunk is not in the initial bundle.

4.3 Receiver feed: List ⇄ Map

Problem — The feed (FoodPage) is a text list. The receiver's real question is "what can I reach in time?" which is spatial and temporal.

Proposal

Toggle List | Map (state in the URL: ?view=map, consistent with existing URL filters).
Map: pins coloured and shaped/labelled by urgency (e.g. clock badge on ending-soon), clicking opens a compact card (name, kg, distance, time left, View food).
Show the search radius as a circle matching the 1/3/5 km filter.
Keep the ranking rule visible: "Sorted by time left, then distance" (docs/DOMAIN_RULES.md), so the order never feels arbitrary.
Add a Sort hint, not a new sort mode, unless the domain rule is intentionally revisited.

Acceptance — same filtered data in both views; selecting a pin and the list row highlights the same listing; map view has a text list alternative (the list view); no coordinates of non-listing entities displayed.

4.4 Capacity transparency

Context — per docs/DOMAIN_RULES.md, the feed already excludes listings larger than the receiver's declared per-claim capacity (capacity_kg is on the session user: lib/identity.ts). So receivers don't hit a server error — they just wonder why a big listing isn't there.

Proposal

A line above the list: "Showing food up to 5 kg per claim (your capacity). 3 larger listings nearby are hidden. [Show them]".
"Show them" lists larger items in a disabled/greyed state labelled "Above your capacity" (no claim button), plus a link to update capacity in /account.
On the detail page opened via a shared link, show the reason next to the disabled claim button instead of only "Food unavailable".

Backend (small) — add hidden_over_capacity_count (and optionally the rows with a flag) to the GET /listings response meta. Everything stays server-authoritative; the UI never decides eligibility.

Acceptance — count matches a SQL check of same-zone, in-radius, live listings with quantity_kg > capacity_kg; empty-state copy distinguishes nothing nearby from everything too large.

4.5 Trust where the decision happens

Problem — The brief's biggest differentiator is trust (verification, ratings, ledger), yet Listing (data.ts) carries only donor_name. Trust lives on a separate "My trust" page. (Verified in the Listing type.)

Proposal — on feed rows and listing detail show:

✔ Verified donor (zone-admin approved) — text + icon.
★ 4.6 (12 ratings) or "New donor — no ratings yet" (never a misleading 0, per domain rules).
Completed-exchange count if available ("38 handovers").
Optional "View ledger-verified history" link for admins only.

Backend (small) — extend the safe donor projection with donor_verified, donor_rating_avg, donor_rating_count from the existing user_trust_summary / public_users views (both are security_invoker, so RLS still applies). No new tables.

Acceptance — null average renders "no ratings yet"; values match /users/{id}/trust; no private fields (phone, email, coordinates) leak into the projection (add an API test).

4.6 Post-claim "what happens next"

Problem — After claiming, the app navigates to /claims/:id, a generic detail page.

Proposal — a status stepper at the top: Claimed → Volunteer assigned → Picked up → Delivered → Rate, with the current step highlighted, a plain-language next action ("Waiting for a volunteer — you'll see an update here"), the pickup address as text + mini-map, and the deadline countdown. Keep the 409-refresh behaviour.

Acceptance — each backend state maps to exactly one step; steps use text + icon (not colour only); the rating prompt appears only after delivery (existing rule).

4.7 Volunteer: act on the move

Proposal

Large primary buttons for the next legal action only ("Mark picked up" → "Mark delivered").
Directions deep link: https://www.google.com/maps/dir/?api=1&destination=<lat>,<lon>.
Call links (tel:) for donor and receiver — the Exchange type already carries donor_phone / receiver_phone for participants.
A "Time to deadline" strip pinned to the top on mobile.
Confirm dialogs only for destructive actions (cancel), not for the happy path.

Acceptance — one-handed operation at 390 px width; tap targets ≥ 44 × 44 px; phone numbers visible only to the participants the API already authorises.

5. Phase 3 — Trust & delight (≈ 3–4 days)
5.1 Admin impact: from numbers to insight

Problem — /admin/impact reports totals. Admins and judges want trends.

Proposal (dependency-free SVG or a tiny chart lib, lazy-loaded)

KPI row: kg picked up, kg delivered, estimated meals (0.4 kg/meal), time-to-claim median, expiry rate.
Time series (daily kg) with the date range the API already supports; stacked by status (Delivered / Expired / Cancelled) to show leakage.
Per-zone comparison bar chart (the API groups by day/zone/city).
CO₂e shown as "Not configured" until a sourced factor exists — never an invented number.
Table beneath with the same data + the existing CSV export; charts need a text/table equivalent.

Acceptance — chart totals equal table totals equal CSV totals for the same filter (add a test); empty ranges show a helpful empty state.

5.2 Live impact strip on the home page

"128 kg shared this month · 320 meals · 14 active listings" from a public, aggregated, non-identifying endpoint (no per-user data, zone-level at most). Backend (small): GET /public/impact. Label figures from synthetic data as "demo data" until real pilot data exists.

5.3 Optional listing photo

Value — a photo is the strongest trust and quality signal for receivers.

Design (keeps the "no extra infrastructure" ADR)

Client-side resize to ≤ 800 px JPEG/WebP (≤ ~150 KB), upload with the listing.
Store as a small bytea thumbnail or a signed object-store URL if/when infrastructure exists.
New migration 0004_listing_photo.sql: nullable photo column + size CHECK; served through an authenticated endpoint (not public).
Strip EXIF (location) server- or client-side.
Moderation: admins can remove a photo; photo removal writes a ledger event.

Acceptance — listing works without a photo; EXIF GPS removed; RLS applies to the photo endpoint; max size enforced server-side.

5.4 Nice-to-have polish
Subtle motion for new listings / status changes (disabled under prefers-reduced-motion).
Success moment after a claim ("Reserved. Here's what happens next").
"Share listing" (already present) — add a WhatsApp deep link (https://wa.me/?text=…) since that's how many NGOs coordinate today.
Empty states with one clear action and an illustration/icon.
6. Code health & performance
Item	Evidence	Action
Very dense one-line JSX	AppLayout.tsx, FoodPages.tsx, DashboardPage.tsx	Format with Prettier; extract FoodRow, FoodFilters, ListingForm sections into small components with prop types
Large components	ExchangePages.tsx ≈ 14 KB, FoodPages.tsx ≈ 13 KB	Split by screen: FoodList, FoodDetail, ListingEditor
Single 34 KB styles.css	src/styles.css	Split by feature (tokens, layout, forms, food, admin); keep CSS variables/dark theme tokens in one tokens.css; consider CSS Modules for new work
Route titles hard-coded in an effect	App.tsx NavigationEffects	Move titles into route metadata (handle: { title }) so they sit next to the route
Duplicated "role gate" strings	Access, AppLayout	Centralise role → destinations map
No skeleton / reduced-motion audit	styles	Add global prefers-reduced-motion rules for all new animation
Hero image 2.2 MB	public/images	See §3.3
No bundle budget	vite.config.ts	Add build.rollupOptions chunking + a CI size check (e.g. fail if main chunk > 200 KB gzip)
Lint scope	eslint.config.js	Add eslint-plugin-jsx-a11y to catch regressions automatically

Target: no behaviour change from refactors — run make lint typecheck test e2e before and after.

7. Role-by-role customer journeys

Donor (mess manager, busy) Today: open form → fill 6+ fields incl. three date-times and coordinates → publish. Target: open → List again or name + quantity + "good for 4 h" → confirm pin → publish (≈ 20–30 s). Sees a preview and, later, a clear status ("Claimed by NGO X, volunteer on the way").

Receiver (NGO coordinator) Today: scan a text list → open detail → claim. Target: see a map and list of live food, ordered by urgency; each row shows donor trust, kg, distance, time left, and whether it fits capacity → claim → get a step-by-step status page with the pickup address.

Volunteer Today: tasks list and status updates. Target: nearest unassigned tasks with distance and deadline → accept → big "Directions" and "Call" buttons → two-tap pickup/delivered.

Admin Today: verify members, review exchanges, totals. Target: a queue with clear counts, one-click approve/reject with reason, and impact charts + CSV that reconcile.

First-time visitor / judge Today: attractive static landing page. Target: a live strip showing real-time (or clearly-labelled demo) impact, plus a 20-second "how it works" that matches the real flow.

8. Expo / demo plan
Race demo — two browser windows claim the same listing: one succeeds, the other sees a friendly "Just claimed by someone else — here are 3 similar listings nearby" (use the 409 handler; add "similar" from the same feed). This showcases the database lock visibly.
Seed realism — seed with believable names, photos (if §5.3 ships), different expiry windows, one listing "ending soon", one "above your capacity".
Impact view — admin charts + CSV + make ledger-verify output on screen to show tamper-evidence.
Be honest about evidence — label synthetic data; say SMS/push is not live; show the stakeholder-validation plan (docs/deliverables/stakeholder-validation.md). TRL 5 is claimed only after a real donor + NGO pilot.
Offline-safe — pre-warm the map tiles or provide the coordinate fallback in case venue Wi-Fi is poor.
9. Testing additions
Area	New tests
formatRemaining	Unit: 0, 59, 299, 300, 3 599, 3 600, 10 800, 86 399 s
Urgency	E2E: < 30 min listing shows "Ending soon" text; contrast check (axe) in light + dark
Presets	E2E: chip → listing published with correct window; "List again" prefill
Map picker	E2E: pin ⇄ fields sync; fallback when tiles blocked (route abort)
Feed map	E2E: toggle persists in URL; list and map show the same IDs
Capacity	API + E2E: hidden-count equals SQL; disabled state explains why
Trust on listing	API: no private fields leak; null rating → "no ratings yet"
Accessibility	Add @axe-core/playwright scans on /, /food, /donations/new, /claims/:id, /admin/impact
Performance	Lighthouse CI budget: LCP < 2.5 s (mobile throttled), CLS < 0.1, main JS < 200 KB gzip
Visual regression	Playwright screenshots (desktop 1505 × 1045, mobile 390 × 844) for the feed and detail pages
10. How to measure that it worked

Instrument locally (or with scripted Playwright runs) and record before/after for the report:

Metric	Target
Time for a returning donor to publish a listing	≤ 30 s (baseline: measure first)
Time from opening /food to a confirmed claim (expert user)	≤ 20 s
Clicks to publish a repeat listing	≤ 3
LCP on mobile (throttled)	< 2.5 s
Hero image transfer size	≤ 150 KB (mobile)
Accessibility violations (axe, serious/critical)	0
Task success in a 5-person hallway test (donor, receiver, volunteer)	≥ 4 of 5 complete unaided

The hallway test also feeds the stakeholder-validation deliverable (docs/deliverables/) — record quotes and screenshots.

11. Explicitly out of scope

Consistent with docs/ARCHITECTURE.md and docs/ADR 0001:

Microservices, Redis, brokers, Kubernetes, paid map services.
Partial claims / splitting a listing.
Automatic "safe window" calculation (the platform never certifies food safety).
Real-time sockets — polling at 15 s is adequate for the prototype.
Publishing receiver/volunteer coordinates or contacts to arbitrary viewers.
12. Correction to the earlier verbal review

Two points in the first chat review should be read as follows after reading docs/DOMAIN_RULES.md and the code:

Capacity — I said receivers might "discover capacity from a server error." In fact the feed already filters out over-capacity listings, so the real problem is invisibility (a listing silently missing), addressed in §4.4.
"Use my location" — it already exists in LocationFields. The improvement is the map picker with coordinates hidden (§4.2), not adding geolocation.