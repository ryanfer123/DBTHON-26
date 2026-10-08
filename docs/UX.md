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
