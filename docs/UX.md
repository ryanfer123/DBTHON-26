# Role interfaces and interaction requirements

The application is a responsive local web prototype. Use role navigation based on
approved capabilities; hiding a control is not a substitute for server authorization.
Multi-role people can switch views without another account. The product must show
plain task language rather than implementation terms such as row locks or SQL.

All screens below are implemented against actual endpoints, with loading/error/empty
states. Approved roles expose tools in the shared desktop sidebar and mobile Tasks menu; pending
members retain inbox/trust and verification refresh. Routes: `/dashboard`, `/help`, `/account`, `/donations`,
`/donations/new`, `/food`, `/food/:id`, `/claims`, `/claims/:id`, `/deliveries`, `/inbox`,
`/trust`, `/admin`, `/admin/exchanges`, `/admin/impact`, `/admin/users/:id/audit`.
The backend rechecks permissions, expiry and capacity on each command.

| Screen | Required information and actions |
| --- | --- |
| Registration/login | Role selection, zone, contact, coordinates, receiver capacity; verification pending notice; no Admin public option |
| Donor dashboard | Own active/history listings, quantity/category/deadline, create/edit/cancel; claim/pickup/delivery status |
| Listing form | Prepared time, window start/end, kg, category and pickup point; field errors; clear donor-provided deadline label |
| Receiver feed | Urgency/distance ranking, zone and radius, capacity eligibility, visible countdown and warning; stable empty/loading/error states |
| Listing detail | Safe donor profile, pickup point, food description, remaining time and whole-quantity claim CTA; refresh after 409 |
| Receiver claims | Claim history, assigned volunteer, progression and cancellation before pickup; rating prompt only after delivery |
| Volunteer tasks | Eligible unassigned nearby claims, scheduled-time entry, accept action |
| Volunteer delivery | Accepted attempt timeline, pickup and delivery actions, deadline and fail/contact workflow; composite IDs kept in client |
| Inbox | Match/status notifications, unread state, mark read; external delivery state not falsely presented as success |
| Settings | Save SMS/push preferences, clear inbox history, and state when external delivery is unavailable |
| My donations | Hide a cancelled listing from the donor's view while retaining linked audit data |
| Admin members | Grant same-zone Admin access with a required reason; public role review remains separate |
| Profile/trust | Approved roles, verification, capacity, average rating and count; own audit history |
| Admin verification | Same-zone pending users, role approvals/rejection reason and audit trail |
| Admin dashboard | Zone/city/date filters, listings/claims/pickups, picked-up vs delivered kg, estimated meal/CO2e factors, CSV export |

## Interaction quality

Mobile-first layouts, keyboard navigation, semantic labels, focus visibility and
plain validation messages. Show units everywhere. Do not encode expiry/status by
colour alone. Buttons are disabled during a request but recover on failure; generate
one idempotency key per intended command and retain it for network retries.
Refresh status after success; server time controls countdown offset. Avoid optimistic
claim success before the server confirms it. Keep direct URL access and refreshing
deep links functional. Do not publish real receiver/volunteer coordinates or contacts
to arbitrary feed viewers. Include an accessible text alternative if displaying maps.

No external map API is required for the core demo. Coordinate inputs and distance
lists are sufficient; browser geolocation is optional and has a manual fallback.

## Shared dashboard and navigation

Sign-in opens `/dashboard` unless a permitted requested deep link, including its
query, was saved. `/account` remains profile settings. The desktop sidebar groups
food sharing, community and administration. Mobile Dashboard, Tasks, Inbox and More
use native modal dialogs for the two menus, with focus trapping, Escape/backdrop
dismissal and restoration to the opening button. Only current approved roles
expose task/admin destinations; pending members retain account/inbox/help/trust.

The dashboard uses `/workspace/overview` for database-wide counts, up to five
active exchanges/assignments ordered by collection deadline and latest unread
updates. Failures provide retry without displaying zero totals. One shared overview
request polls every 15 seconds in visible tabs, refreshes on visibility return and
after successful commands or member reviews. Role changes trigger session refresh.

Food name/category/radius/status, exchange status, delivery view/radius/status,
member verification and inbox unread filters live in URL parameters. Changes reset
cursors. Router state retains the previous cursor trail; refresh and Back/Forward
restore it. New direct links without a trail offer Back to first page. Breadcrumbs
on food/exchange/editor/audit screens provide parent destinations; food/exchange
links retain the originating filter URL. Help searches the existing FAQs and offers
role-specific working tools. Forest/sage styling and persistent dark mode remain.

## NomNom shared visual system (2026-10-08)

The product name is **NomNom**. Aritra's frontend branch supplies the visual source
of truth in `frontend/src/styles/tokens.css`, `nomnom.css`, and `marketing.css`:
cream/forest-green surfaces, orange accents, display headings, rounded controls and
panels, with token-based dark mode. Shared role layouts carry this system through
identity/settings, dashboard, food and exchange workflows, requests and updates,
inbox/trust, impact and administration. Marketing animation remains on public pages;
role screens prioritize readable labels, usable controls and clear task states.
Existing routes, role visibility, CSRF headers, stored theme preferences and API
contracts are retained. The integration does not mark any design as user-approved.

## Compact recorded actions

Trust history defaults to three compact audit entries per page. “Show full history”
switches to twenty entries per page; “Show fewer actions” restores compact mode and
returns to the first page. “Hide history” collapses the list and pagination, while
“Show history” restores it. These controls apply to personal and administrator member
history. Individual audit payloads remain inside expandable details. No audit records
are deleted or changed; ledger verification remains available. Changing member resets
the view and cursor. Browser-push work remains on its separate feature branch.

## Themed dropdown option menus

All application selects now use `ThemedSelect`, including exchange status, food
filters, registration/community areas, donor handling, recurring schedules and admin
review forms. The trigger and portalled menu use shared surface/green/sage tokens,
rounded corners, checkmarks and visible focus, including dark mode. Radix Select
supplies managed focus, keyboard navigation, typeahead and outside/Escape dismissal:
[official component reference](https://www.radix-ui.com/primitives/docs/components/select).

A visually hidden native select preserves actual submitted option values (including
empty “All…” filters), required-field validation and form reset. Missing required
choices focus the visible trigger and display a field error. Disabled placeholders
stay disabled. The menu implementation loads separately; a disabled loading trigger
appears until it is ready. Only the shared component contains native select elements;
application pages use the themed control. Native-select-specific browser automation
must use the new combobox/option interaction when future browser checks are requested.

## Search and filters (2026-10-09)

Both food views have an explicit “Search and filters” heading. My donations now
exposes Listing status, Category, Diet tag, Exclude declared allergen and Sort by
time. The receiver feed exposes Search radius, Category, Diet tag and allergen
exclusion, while retaining the existing capacity controls.

Food-name search updates automatically after a 250 ms typing pause; Enter submits
immediately. “ch” matches names starting with “ch”, regardless of case. Composition
input waits until composition ends. Changing search/filter/sort resets pagination;
typing replaces the current URL rather than creating a Back entry per keystroke.
The input stays mounted, and pending typed characters are preserved while its own
URL update arrives. Back/forward URLs and Clear filters restore the displayed text.
The API query hook aborts superseded fetches. An Updating results message accompanies
pending searches; no-match feedback distinguishes filtering from a first donation.

Collection deadline is the initial time ordering; My donations can also use Newest
listings or Oldest listings. Receiver ordering remains deadline, distance and ID.
All matches are reachable through server pagination; filtering is not limited to a
client-side subset of loaded listings. Donor declarations do not certify safety.
