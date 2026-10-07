# Database Design deliverable

Source baseline: PDF section 6, pp. 7-13. Canonical target:
[database specification](../DATABASE.md), [original ER diagram](../source/figures/er-diagram-page-08.png),
[database artifact guide](../../database/README.md).

Required implementation evidence: migration IDs, complete tested DDL, seed DML,
ER/EER mapping, normalization, nested/join/aggregate queries, stored routines,
triggers, views, row-lock race, indexes/EXPLAIN and RLS/grants tests.

Record exact PostgreSQL/PostGIS versions, setup and execution commands, outputs,
commit ID, screenshots where useful and differences from the illustrative PDF SQL.

Implemented foundation: Alembic `0001`, executable DDL/routines/guards/views/RLS in
`database/0001_initial.sql`, importer in `backend/app/seed.py`, course queries in
`database/examples.sql` and independent verifier in `backend/app/trust/verify.py`.
Revision `0002` adds private auth/verification routines and session CSRF fields.
PostgreSQL 17.5/PostGIS 3.5: migration/fixture totals and 56 real DB/API checks pass;
see [STATUS.md](../STATUS.md) for commands and limitations. Remaining authenticated
listing/delivery workflows, worker and performance benchmark stay pending.
