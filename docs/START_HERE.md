# Prompt for the next implementation session

Copy this prompt into the coding session with this repository open:

> Implement the DBTHON-26 project described in this repository. First read AGENTS.md,
> README.md, docs/STATUS.md, docs/IMPLEMENTATION_PLAN.md, docs/REQUIREMENTS.md,
> docs/DATABASE.md, docs/DOMAIN_RULES.md, docs/API.md, and ADR 0001. Preserve the
> original brief and use the recorded design defaults. Start with the first
> unfinished implementation task, complete its acceptance criteria, and progress
> through the prototype milestones. Build real PostgreSQL/PostGIS transactions and
> tests, then connect the responsive role-specific frontend. Use the supplied
> synthetic fixtures; do not invent interviews or pilot evidence. Keep requirement
> coverage, database design, API documentation, and STATUS.md synchronized with
> actual changes. Run relevant checks and state exactly what passed and what remains.
> External deployment, paid services, and contacting stakeholders require a separate
> request. Continue using routine implementation judgment unless a decision blocks
> correctness.

## First concrete task

P01-P03 are complete: public apps, migrations, scoped database access, guarded claims,
fixtures/verifier and identity/admin APIs pass real PostgreSQL checks. Responsive
account and admin-review screens also work; P09's domain screens remain unfinished.
Start P04:
listing CRUD, geo-temporal/capacity feed, safe donor projections, urgency ordering and
deadline fields. Use `app.routes.identity.context` and the existing restricted pools;
preserve session-derived identity, CSRF, sorted locks and atomic audit/outbox writes.

## Resume a later session

Read `docs/STATUS.md` and Git history first. Run documented checks before assuming
the previous session finished. A completed plan checkbox must have reproducible
evidence; otherwise restore it to unfinished and document the missing work.
