# Database artifacts to implement

The target model is specified in [docs/DATABASE.md](../docs/DATABASE.md).
P02 adds versioned Alembic migrations under apps/api plus reviewable SQL/course
demonstrations here. There are no migrations or application tables yet.

Required artifacts: ER/EER mapping; full schema; constraints; sample DML/joins/nested
and aggregate queries; transaction-safe claim routine; transition/immutability
triggers; expiry routine; reporting views; B-tree/GiST/partial indexes; explicit
RLS and runtime-role grants; normalization explanation; reproducible seed importer.
Keep SQL demonstrations aligned with migrations and tested against PostgreSQL.
