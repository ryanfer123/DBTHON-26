# Executable database foundation

Alembic revision `0001` applies [0001_initial.sql](0001_initial.sql) in a transaction.
It preserves all eight source entities plus the documented extensions. PostgreSQL
17/PostGIS 3.5 is required; migration bootstrap needs extension/role-creation rights.
Runtime has restricted column SELECT and guarded-function EXECUTE, without generic
DML. `dbthon_guard` is a private NOLOGIN/BYPASSRLS function owner; never grant its
membership to an application login. Revision `0002` adds identity routines and CSRF;
auth and runtime login accounts are provisioned separately with `make db-access`.
Revision `0003` applies [0003_workflows.sql](0003_workflows.sql): domain commands,
ratings, trust summaries, expiry and in-app delivery. The separately provisioned
worker login can execute only its maintenance routines; it cannot read all users.
Revision `0004` provides RDS-compatible function-owner row policies. Revision `0005`
adds listing-photo metadata; `0006` adds account settings and audited user-view
controls while preserving domain and audit records. `0007` adds the community
requests, pickup agreements, updates and suggestions. Its forward-only bridge
also completes the account-settings schema on the live database whose earlier
community-only `0006` was deployed before the independent settings migration.

`make migrate`, `make seed ANCHOR=2026-10-05T12:00:00Z`, `make ledger-verify` apply,
import and independently check the fixture. Seeding requires empty application
tables on its first run; the same hash/anchor is a no-op. A changed anchor is an
explicit conflict. Seeded account hashes are disabled; [interactive local setup](../docs/IDENTITY.md)
enables selected fixture logins without a shared password in Git.
Synthetic historical records are labelled by one fixture-import event per user;
they are not evidence of real deliveries or stakeholder use.

`make db-test` creates/uses only `dbthon_test`, clears its application tables for
each case and runs real locking/RLS tests. Never put valuable data in that database.
The reset CLI additionally refuses any configured database without a `_test` suffix.
Owner/migration credentials are for local setup; do not deploy the API with them.

See [schema/ER/normalization](../docs/DATABASE.md),
[course queries](examples.sql), and [verification evidence](../docs/STATUS.md).
Historical migrations are immutable once published; add new revisions for changes.

Revision 0004 adds managed-owner guard policies without new tables. SQL remains the authoritative migration source; run `python3 scripts/check_migrations.py`.

Revision 0005 adds [authenticated listing thumbnails](0005_listing_photos.sql) and a non-identifying public aggregate routine. Apply through Alembic; do not edit earlier deployed revisions.

Revision 0008 refreshes the Vellore zones, asks existing accounts to confirm their
community area, and enables the named bootstrap Admin to review and delegate across all
zones. Other Admins remain in their own zone. Zone changes are blocked while the user
has an active listing, claim, or pickup; old listing zone snapshots remain intact.

Revision 0008 retains the exact live zone-repair migration, including its conditional
column creation. Revision 0009 adds the missing runtime read grant for the review
flag and aligns member-read RLS with the explicit bootstrap-admin predicate.

- `0010_donor_safety_schedules.sql`: guarded donor declarations and daily reminder schedules.
- `0011_external_alerts.sql`: consenting channel outbox, demo budget and provider receipts.
These drafts are not applied to AWS; validate them on disposable PostGIS before release.

Revision `0012` prepares saved listings, private exchange messages, evidence-linked
reports and personal impact routines. Its guarded mutation/SELECT boundaries follow
0011. The source migration remains unapplied pending runtime release checks; see
[comparison and rollout notes](../docs/COMPETITOR_GAP_ANALYSIS.md).

Revision `0014_account_deletion.sql` follows `0012` in this branch and adds guarded account/profile erasure with retained pseudonymous audit identity. Apply through Alembic. Revision `0013` on the separate undeployed browser-push branch must be reconciled into one forward chain before merging/deploying both features.
