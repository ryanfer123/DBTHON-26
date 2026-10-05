# Executable database foundation

Alembic revision `0001` applies [0001_initial.sql](0001_initial.sql) in a transaction.
It preserves all eight source entities plus the documented extensions. PostgreSQL
17/PostGIS 3.5 is required; migration bootstrap needs extension/role-creation rights.
Runtime has restricted column SELECT and guarded-function EXECUTE, without generic
DML. `dbthon_guard` is a private NOLOGIN/BYPASSRLS function owner; never grant its
membership to an application login. Auth/worker role capabilities arrive in P03/P07.

`make migrate`, `make seed ANCHOR=2026-10-05T12:00:00Z`, `make ledger-verify` apply,
import and independently check the fixture. Seeding requires empty application
tables on its first run; the same hash/anchor is a no-op. A changed anchor is an
explicit conflict. Seeded account hashes are disabled, with no shared login password.
Synthetic historical records are labelled by one fixture-import event per user;
they are not evidence of real deliveries or stakeholder use.

`make db-test` creates/uses only `dbthon_test`, clears its application tables for
each case and runs real locking/RLS tests. Never put valuable data in that database.
The reset CLI additionally refuses any configured database without a `_test` suffix.
Owner/migration credentials are for local setup; do not deploy the API with them.

See [schema/ER/normalization](../docs/DATABASE.md),
[course queries](examples.sql), and [verification evidence](../docs/STATUS.md).
Historical migrations are immutable once published; add new revisions for changes.
