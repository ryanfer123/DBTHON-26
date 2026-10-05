# Role interfaces and interaction requirements

The application is a responsive local web prototype. Use role navigation based on
approved capabilities; hiding a control is not a substitute for server authorization.
Multi-role people can switch views without another account. The product must show
plain task language rather than implementation terms such as row locks or SQL.

Implemented now: public welcome/role navigation, `/register`, `/sign-in`, `/account`
and `/admin` verification. Forms use real identity APIs, empty initial inputs,
database-backed area labels, pending/approved roles and recoverable request errors.
The remaining rows below are acceptance targets, not rendered placeholder screens.

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
