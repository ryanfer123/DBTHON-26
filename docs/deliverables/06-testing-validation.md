# Testing & Validation results

Canonical plan: [T01-T12](../TESTING.md). This file records observed results only.

| Run date | Commit | Environment | Command | Actual result | Evidence path / limitation |
| --- | --- | --- | --- | --- | --- |
| 2026-10-05 | P01 62d7cda; P02 see Git history | Python 3.13.15, Node 22.19.0, PostgreSQL 17.5/PostGIS 3.5 | `make test`; `make db-test`; `make e2e` | 7 backend unit + 33 DB + 4 web + 4 browser checks passed | [STATUS.md](../STATUS.md); foundation evidence only, full T01-T12 pending |

Append concurrency winner/loser proof, expiry-without-write demonstration, RLS
negative tests, rollback/ledger verification, E2E screenshots and benchmark hardware/
sample size/percentiles. Retain failed cases and reproduction instructions.

Stakeholder validation is separate; synthetic tests do not establish real-world impact.
