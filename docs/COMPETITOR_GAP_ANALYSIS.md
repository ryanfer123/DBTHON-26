# Food redistribution platform comparison

Research date: 2026-10-07. Sources are the platforms' own product/help pages.
These are established examples, not an independently verified popularity ranking.
The comparison covers documented capabilities, not a hands-on audit of their apps.

## What comparable platforms document

| Platform | Documented capability | Second Table before this extension | Decision |
| --- | --- | --- | --- |
| Too Good To Go | Nearby discovery, favorites, alerts and personal impact | Nearby maps/filters already exist; private saves and personal totals missing | Add saves and personal impact; paid surprise bags remain outside the donation model. [Official app guide](https://www.toogoodtogo.com/en-us/how-does-the-app-work) |
| OLIO | Private watchlist; arranged pickups treated differently from unavailable items | No saved-listings view | Add private live-listing watchlist. Saving creates no reservation or donor alert. [Watchlist help](https://help.olioapp.com/en/articles/12158509-what-is-the-watchlist) |
| OLIO | Specific listing/message reports; keeping conversations within the platform | Phone/contact and pickup confirmation exist; no private conversation or evidence-linked report queue | Add participant chat and reports linking the precise listing, exchange and optional message. [Reporting help](https://help.olioapp.com/en/articles/12277035-how-do-i-report-issues-or-problems-on-olio), [Communication guidance](https://help.olioapp.com/en/articles/12258916-how-can-i-avoid-scams-when-using-olio) |
| Food Rescue US | Pickup scheduling, instructions, cancellations and recurring rescue adoption | Scheduling, rescheduling and cancellations exist; daily donor reminders are prepared on this branch | Add calendar export of agreed pickups; retain fresh donor confirmation rather than automatic relisting. [Official app description](https://foodrescue.us/our-app/) |
| Food Rescue Hero | Volunteer coordination, rescue information and individual impact | Task acceptance and progress exist; only community/admin impact reports | Add own participation totals with collected versus delivered food kept separate. [Official product description](https://foodrescuehero.org/our-product/) |
| FoodCloud | Business-to-charity matching and collection coordination | Food-needs board and donor offers already exist | Preserve the existing needs/offers model and collection agreement. [Charity product page](https://www.food.cloud/get-food), [Business product page](https://www.food.cloud/give-food) |

## Implemented in source: CE01–CE05

- **CE01 Saved listings:** feed/detail buttons and sidebar page, own-account storage,
  bounded pagination, automatic exclusion of expired/completed/cancelled items.
  Claimed items remain visible but cannot be claimed again. Old inactive saves are
  pruned when saving, so they cannot exhaust the 100-item limit permanently.
- **CE02 Exchange messages:** donor, receiver and currently assigned volunteer;
  1,000-character messages, 20 per ten minutes, pagination, polling and inbox alerts.
  Current role/zone and recipient snapshot are checked on every read. Replacement
  volunteers do not receive previous conversations; former volunteers lose access.
  Terminal exchanges are read-only. Message bodies never enter the trust ledger or
  SMS/WhatsApp alert text. Admin status alone does not grant chat access.
- **CE03 Issue reporting:** listing/exchange/message references, reporter history,
  scoped admin queue, recorded outcome and reviewer note. Reports are limited to
  five per day and one open report per target. Only a specifically reported message
  becomes admin evidence. Admins cannot review their own reports. Resolving a report
  does not bypass claims, change trust scores, relist food or certify safety.
- **CE04 Personal impact:** current-zone participation, 30/90/365-day windows,
  distinct collected/delivered kg, delivered exchange count and donor/receiver/
  volunteer role totals. Role figures can overlap; overall delivery is deduplicated.
  Meals use the existing 0.4 kg assumption. No unvalidated emissions factor is added.
  Database fixture presence is explicitly labelled; these are not pilot measurements.
- **CE05 Calendar export:** local ICS download for a fully agreed current pickup,
  stable pickup UID and proposal sequence, no contact details. Files do not subscribe
  to updates; users refresh and download again after rescheduling. This requires no
  calendar account or external API.

## Existing gaps that still need external evidence or setup

SMS/WhatsApp sending cannot become live without a provider account, consented demo
recipient and approved configuration. The prior branch has a disabled, bounded
transport adapter; no real notification delivery is claimed. PWA install/offline
shell, allergen declarations and daily donor reminders are also prepared on this
branch, pending runtime release checks.

Campus mess/NGO conversations and physical rescue evidence cannot be created through
code. Use [the interview guide](pilot/INTERVIEW_GUIDE.md) and [bounded pilot plan](pilot/BOUNDED_PILOT.md);
record only actual consented responses and observed outcomes. Route optimization,
payments and cross-zone allocation are future scope rather than inferred requirements.

## Release and reproduction

Migration `0012_exchange_experience.sql` and its Alembic loader follow `0011`.
No new paid service or runtime dependency is introduced. Source is prepared on
`feat/donor-safety-alerts`; see [STATUS.md](STATUS.md) for observed static checks and
pending PostgreSQL/browser gates. Deploy database and API before publishing UI.
