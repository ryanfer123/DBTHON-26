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

P01: scaffold `apps/api/` and `apps/web/`, pin dependencies and lockfiles, add an API
health endpoint and web shell, document development commands, and prove both start.
Then P02 implements migrations, invariants, indexes, and deterministic fixture seeding.
Do not jump to dashboard visuals before the concurrency-critical database workflow.

## Resume a later session

Read `docs/STATUS.md` and Git history first. Run documented checks before assuming
the previous session finished. A completed plan checkbox must have reproducible
evidence; otherwise restore it to unfinished and document the missing work.
