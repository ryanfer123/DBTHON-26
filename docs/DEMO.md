# Controlled demonstration script

Core workflows now run. Use P11 to record a controlled demonstration with reproducible evidence. Use synthetic identities and
rebased seed times; record the commit and setup commands with screenshots/video.

1. Reset a disposable database, migrate, import demo fixtures with a current UTC
   anchor. Explain that source figures are preserved and current data is synthetic.
2. Log in as zone-1 Admin; show pending receiver verification and approved roles.
3. Log in as zone-1 Donor; create 8 kg Veg food with an open window and local pickup.
   Show rejection of negative quantity or end-before-start.
4. Log in as two eligible Receivers in separate sessions. Show urgency/distance feed,
   insufficient-capacity and other-zone exclusions. Race one listing claim.
   Show one confirmed claimant, one conflict, and SQL proof of one allocation.
5. As a verified Volunteer accept the task, mark pickup and deliver before expiry.
   Show server timestamps, composite attempt identity and completed allocation.
6. Rate donor from receiver and receiver from donor; reject duplicate/early/stranger
   rating. Show rating count/average and a verifiable per-user ledger export.
7. Show an Available listing passing expiry with no user edit; prove feed exclusion
   and worker terminal state. Show missed pickup history with replacement attempt.
8. Open admin report: compare picked-up and delivered kg, estimated meals, null
   CO2e factor, date/zone filters and matching CSV. Show notification inbox; describe
   external channel as implemented only if real delivery evidence exists.
9. Present test summary and course deliverables. Distinguish controlled prototype
   evidence from pending donor/NGO interview or pilot evidence.

Never use a production reset or real food exchange as a casual demo task.

Role entry points: Donor `/donations/new`, Receiver `/food`, Volunteer `/deliveries`,
Admin `/admin`, `/admin/exchanges`, `/admin/impact`. Approve newly registered public
roles through Admin review first. Fixture logins remain disabled until explicitly
enabled locally with `scripts/demo_password.py --user ID` (interactive, no shared
password in Git). Synthetic zone-1 IDs: Donor 101, Receiver 102, Volunteer 103, Admin
104. Test fixtures and local demo account activation are separate.

Run `make worker` alongside independently started API/web, or `make dev` for all
three. The worker processes expiry and durable in-app updates after commit. Its
absence never permits a stale claim/delivery; guarded commands still check deadlines.
