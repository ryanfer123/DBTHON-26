# Planned integration evidence

The initial automated check is `python3 scripts/validate_handoff.py`.
It validates repository context and synthetic fixtures, not a working application.
Application tests will live in backend/tests, frontend and shared integration/E2E
directories chosen during P01. Read [the acceptance matrix](../docs/TESTING.md)
before adding tests. Store generated evidence under ignored artifacts/ and commit
only deliberately selected, sanitized course evidence.
