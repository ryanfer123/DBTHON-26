# Contributing and resuming implementation

Read [AGENTS.md](AGENTS.md), [current status](docs/STATUS.md), and the
[implementation plan](docs/IMPLEMENTATION_PLAN.md). Begin with the first unfinished
task, not an assumed previous milestone. P01 now runs in apps/api and apps/web;
the database/domain tasks remain unfinished.

Before a PR, run `python3 scripts/validate_handoff.py` and any actual application
checks added for the task. Describe the concrete behavior, requirement/task IDs,
validation evidence and limitations. Keep migrations, database/API docs, fixtures,
requirements coverage and status aligned. Preserve imported source files; document
design corrections in decisions rather than rewriting original evidence.

No software license has been selected. Keep local configuration, raw interview
records and generated artifacts out of Git. Use de-identified evidence for course
deliverables and mark simulation, estimates and actual pilot observations accurately.
