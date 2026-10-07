# UI/UX implementation and verification

Requested plan: [preserved request](UI_UX_REQUEST.md). Work is isolated in
`/private/tmp/dbthon-ui-ux`, based on published d0d9788. Concurrent AWS drafts and
deployment/migration work in `/Volumes/Seagate/dbthon` are preserved.

## Implemented behavior

- Server-anchored human countdowns, explicit clock/Ending soon text, minute-granular
  screen-reader text, matching skeleton rows and reduced-motion rules.
- Responsive WebP hero: 27998 / 68256 / 141898 bytes, with width/height preserved.
- Last-loaded views survive failed refreshes with explicit stale/retry feedback.
  Feed polling runs while visible; new rows wait behind an explicit updates pill.
- Collection presets, quantity steps and labelled meal estimates, receiver preview,
  fresh-time List again and per-account remembered pickup location.
- Lazy draggable map picker with synchronized advanced coordinate controls; tile
  failure opens those controls. Feed map/list view and filters persist in URLs;
  pins and row selection refer to the same paginated filtered data. Directions,
  coordinate copy and text alternatives remain available.
- Exact larger-listing counts, optional ineligible rows and server eligibility
  reasons; safe donor verification/rating projection at the point of decision.
- Exchange next-step guidance and a labelled status stepper; participant-only
  contacts/directions and mobile deadline strip preserve existing legal actions.
- Public monthly impact with synthetic-data provenance; scoped SVG outcome charts,
  exact overall median, cohort expiry rate, table and CSV from the same SQL data.
- Optional bounded authenticated photos, independent server metadata removal,
  atomic listing/photo writes and ledger-recorded administrator removal (0005).
- AWS bootstrap exposes a one-shot migration operation restricted to an initialized
  0004 database; it applies the forward-only 0005 revision without fixture seeding.
- WhatsApp share drafts and explicit inbox/SMS/push capability wording.
- Screen/row/form extraction, formatted JSX, CSS feature/token files, route title
  metadata alongside routes, shared navigation destinations, accessibility lint,
  lazy map chunk and enforced 200 KB gzip initial-JavaScript/hero build budgets.

## Deliberate corrections and boundaries

- The request calls the photo migration 0004; 0004 is already the deployed RDS
  compatibility revision. Photos use 0005 and preserve both earlier migrations.
- Existing rating-row RLS limits direct aggregates. The safe sealed trust routine,
  rather than the invoker view, supplies ratings matching the trust endpoint.
- Administrators compare only their authorised zone. No global cross-zone admin
  report is introduced; the new public endpoint exposes non-identifying totals.
- OSM tile policy prohibits bulk prefetch. The demo uses coordinate/text fallbacks
  rather than pre-warming tiles. Browser tests intercept tile requests entirely.
- Synthetic fixtures and automated timing are not stakeholder or pilot evidence.
  The five-person hallway study and a genuine donor/NGO pilot remain outstanding.
  TRL 5, food-safety certification, SMS/push delivery and CO₂e are not claimed.

## Verification record

- `POSTGRES_PORT=55435 POSTGRES_PASSWORD=local-test-only PYTHONPATH=apps/api apps/api/.venv/bin/pytest apps/api/tests --db -q -x` — 105 passed on PostgreSQL 17/PostGIS. Two upstream deprecation/field warnings remain.
- `npm run lint --prefix apps/web`, `npm run typecheck --prefix apps/web`, and `npm run test --prefix apps/web` — passed; 25 unit tests passed.
- `npm run build --prefix apps/web` — passed; initial JavaScript is 111,919 bytes gzip, below the 204,800-byte budget; all three responsive hero images met their byte limits.
- `apps/api/.venv/bin/ruff check apps/api deploy/aws-lambda/bootstrap.py`, `apps/api/.venv/bin/mypy apps/api/app`, and `python3 -m compileall -q deploy/aws-lambda/bootstrap.py` — passed.
- `apps/api/.venv/bin/python scripts/export_openapi.py --check`, `python3 scripts/validate_handoff.py`, and `git diff --check` — passed.
- Lighthouse mobile Fast 3G with 150 ms request latency, 1,638 Kbps download, and 4x CPU slowdown: LCP 2,229 ms, CLS 0, TBT 0 ms, performance score 0.97. This is a local synthetic run.
- `POSTGRES_PORT=55435 POSTGRES_PASSWORD=local-test-only DBTHON_BROWSER_TEST_DATABASE=dbthon_usability_browser_test npm run test:e2e --prefix apps/web` — 30 passed across desktop and 390 px mobile projects. Coverage includes navigation, registration, food/photo/map/listing, help, theme, dashboard, filtering/history, exchange/delivery/rating, reports, keyboard and axe checks. Scripted timing is not participant research.
- Published to GitHub `main` as `7e5750faa9809b919bcf9ad2624b0d3379c6de75` (`Complete UI and food-sharing improvements`); the remote ref was verified to match.
- AWS `DbthonRenderApi` updated without resource replacement or database replacement; its change set modified existing API, bootstrap, and worker code plus their schedule target/permission references. The guarded bootstrap migrated the existing database from 0004 to 0005, reporting `previous_migration=0004`; no fixtures were seeded. Lambda readiness returned HTTP 200 with `status=ready`.
- Render static service `DBTHON-26` automatically deployed the same commit and reports it live. Public `/`, `/help`, and `/food` routes each returned HTTP 200.

The repository's broader controlled-demo/P11, five-person hallway study and genuine
donor/NGO pilot remain outstanding. Automated verification does not establish those
results or production migration state.
