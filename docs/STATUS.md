# Implementation status and session handoff

Updated: 2026-10-07 (Asia/Kolkata). Stage: P01-P10 core prototype implemented.
Donor listings, receiver feed/claims, volunteer delivery, expiry/inbox worker,
ratings/trust/audit and scoped admin reporting are connected. The longer homepage,
dark-mode preference and share-link behavior were added at the user's request.
FR08 external SMS/push remains partial. P11 controlled-demo/performance evidence
and P12 genuine stakeholder/pilot evidence remain outstanding.

Publication authorization: on 2026-10-05 the user explicitly approved pushing the
complete handoff to GitHub, including the original PDF, extracted brief, student
names and registration numbers. The earlier publication approval block is resolved.
Local setup is complete; the repository handoff is intended for GitHub publication.

## Completed initialization

- Cloned the initially empty `ryanfer123/DBTHON-26` repository into this workspace.
- Preserved the exact original 16-page PDF, full extraction and three diagram pages
  with a SHA-256 manifest.
- Prepared contributor instructions, source context, requirements/traceability,
  architecture/ADR, schema and domain specifications, API/UX, implementation tasks,
  validation plan, demo script and all eight course-deliverable templates.
- Prepared fictional four-zone demo fixtures with relative timestamps, retry history,
  capacity edge cases and independently reconcilable baseline impact expectations.
- Added PostgreSQL/PostGIS Compose configuration, ignored local environment template,
  development notes, PR/task templates and handoff-check CI configuration.

## Verification record

Observed initialization checks:

| Command / check | Actual result |
| --- | --- |
| `python3 scripts/validate_handoff.py` | PASS: source hashes and 16-page extraction, relative links, FR01-FR10/NFR01-NFR06 coverage, P01-P12/T01-T12, eight deliverables, fixture constraints and hand-computed totals |
| `POSTGRES_PASSWORD=compose-validation-placeholder docker compose config --quiet` | PASS: Compose configuration parses with a throwaway validation value; no service started |
| Original PDF vs repository PDF SHA-256 | Identical; complete byte-for-byte source preserved |

The original handoff checks used Python 3.14.7. Subsequent application checks and
Docker startup are recorded below; no notification or pilot results are claimed.

## P01 implementation and observed checks

- API factory, configuration/pooling, public community response, liveness and real
  PostGIS readiness, safe failure responses and request IDs.
- React welcome screen and accessible role tabs backed by the API, deep-link refresh,
  error/retry, mobile layout and selected design reference in docs/design.
- Committed Python/npm lockfiles, dev/setup/export scripts, Make commands and API/web/
  browser CI configuration. Local `.env` is ignored and credentials are not printed.
- Local versions: Python 3.13.15, Node 22.19.0, PostgreSQL 17.5, PostGIS 3.5.

| Check | Observed result |
| --- | --- |
| pytest | 6 passed, including truthful readiness and redacted connection failure |
| Ruff / strict mypy | Passed; no backend lint/type errors |
| ESLint / TypeScript | Passed |
| Vitest | 4 passed: role/keyboard navigation, direct route, offline retry, missing route |
| Vite production build | Passed |
| Playwright desktop/mobile | 4 passed against live API and PostgreSQL/PostGIS |
| Native 1505x1045 + mobile 390x844 screenshot/console inspection | Meaningful content, no framework overlay, no app warnings/errors, no horizontal overflow |
| Live health checks | `alive` and `ready`; PostgreSQL/PostGIS versions queried directly |

Visual comparison used `view_image` on both the retained concept and browser render.
Inspected white/forest/sage palette, header, two-line heading, timeline positions,
CTA, tabs, community band and footer. Fixed initial heading wrap, column width,
CTA size and vertical spacing. Copy above the fold matches the concept. Intentional
extensions: route-backed receiver/volunteer descriptions, loading/error/retry states,
and mobile stacking. Browser plugin absent; used Playwright with installed Chrome.
Current tests are foundation evidence, not T01-T12 domain completion or TRL validation.
Remote CI configuration exists; a passing hosted run has not been verified.
GitHub main was verified at P02 commit `f36fdde42a4a71f97e85346b5f7ea7aab887f6fa`
after pushing P01 and P02. Hosted Actions status could not be read: `gh` is absent
and the unauthenticated Actions API returned 404. Local results below are confirmed;
no hosted CI success is claimed.

P01 commit: `62d7cda`. Exported that commit into a clean directory, installed both
locked dependency sets offline from caches, passed six backend tests and the web
production build, started API/web on separate ports, and observed 200 responses
for readiness, community and the web page. Temporary processes were stopped.

## P02 implementation and observed checks

Implementation commit: `f36fdde`.

- Alembic revision `0001`, original eight entities and seven extensions, PostGIS/
  pgcrypto, partial allocation indexes, composite pickups, spatial/FK indexes.
- FORCE RLS and column permissions; session-derived actor identity; private fixed-path
  definer helpers; immutable ledger/transition triggers and guarded atomic claims.
- Canonical Unicode SHA-256 append with sorted user locks; independent Python verifier.
- Repeatable, transactional synthetic importer and explicitly disposable reset command.
- Course JOIN/nested/aggregate/geo-query examples and updated ER/normalization mapping.

| Check | Observed result |
| --- | --- |
| Empty local PostgreSQL migration | Revision 0001 applied; PostGIS 3.5 and pgcrypto present |
| Same fixture/UTC anchor imported twice | First import adds data; second is a no-op; 20 users/12 listings/3 claims/4 pickups/2 ratings |
| Independent fixture ledger verification | 20 entries valid; no hard-coded demo password |
| `pytest apps/api/tests --db -q` | 40 passed: 7 unit and 33 real PostgreSQL checks |
| Competing claim transactions | Exactly one allocation, two participant events, two pending outbox rows |
| Actual PostgreSQL lock wait across expiry | Wait observed in pg_stat_activity; claim denied after release, no allocation |
| Permission/RLS checks | Zone/participant isolation, pending/revoked actor denials, no hash/session reads or generic runtime writes |
| Audit checks | SQL/Python Unicode bytes match; concurrent appends serialize; mutation/deletion rejected; modified export and missing chain prefix detected |
| Fixture impact view | 14.00 kg picked up, 10.00 kg delivered, 25.00 estimated meals; zero-activity zones retained |
| Ruff / strict mypy | Passed |
| Disposable reset + re-migration | `POSTGRES_DB=dbthon_test python scripts/database.py reset-test` passed; full 40-check rerun passed |
| Course SQL examples | All six result sets, including EXPLAIN ANALYZE, executed successfully |

Database tests reset only `dbthon_test`; the seeded local `dbthon` is preserved.
Historical synthetic transactions are bootstrap records, labelled by fixture-import
events rather than claimed real-world activity. Full T01-T12 remain incomplete.
At the P02 checkpoint the HTTP contract had only public/health routes. P03 extends
it below; idempotency/cancellation, delivery, worker, reports and connected role
screens remain later milestones.

## P03 implementation and observed checks

Implementation commit `f3bd327a4c840b6ad5be54e1ff1a949248474945` was pushed and
verified against GitHub main. A clean export of that commit installed its locked
API dependencies offline, passed nine unit tests and the OpenAPI drift check,
then started on a separate port with existing restricted URLs supplied through
its process environment. Readiness/zones returned 200; the temporary API was stopped.

- Revision `0002` adds session CSRF hashes, private auth-rate buckets/verification
  reviews and identity SQL routines; baseline `0001` is unchanged.
- Separate real non-owner LOGIN roles/pools for auth/runtime, with fail-closed
  membership/ownership checks and transaction-local role/session/CSRF context.
- Argon2id registration and rehash, normalized unique contacts, pending/multiple
  public roles, positive receiver capacity and self-profile updates.
- Opaque hashed sessions, rotation/12-hour expiry/five-session bound, server-side
  logout revocation, private/no-store responses, CSRF/custom-header/origin protection.
- Scoped Admin lists/verification/revocation, requested-role validation, private
  review reasons, safe DTOs and atomic identity ledger/notification writes.
- Repeatable local login provisioning and interactive synthetic password setup,
  neither printing nor committing credentials; `.env` permission observed as 0600.

| Check | Observed result |
| --- | --- |
| `pytest apps/api/tests --db -q` | 65 passed: 9 unit + 56 real PostgreSQL/API checks |
| Revision upgrade/downgrade/reset | Disposable dbthon_test reset and both revisions reapplied successfully; original local demo data preserved |
| Identity security cases | Admin/self-approval flags rejected, private inputs omitted from 422/errors, wrong/unknown/disabled credentials use safe 401, persistent throttle returns 429 |
| Session cases | Hash-only storage, cookie flags, expiry/inactive/revoked denial, rotation, five-session bound, logout and local password setup revoke old cookies |
| CSRF/origin cases | Missing/wrong token, missing custom header and cross-site origin/metadata denied without profile/audit changes |
| Admin/role cases | Same-zone only, ID/filter cross-zone 404, no new Admin or unrequested grants, multi-role subset replacement and immediate revocation |
| Actual restricted login roles | Runtime cannot SET ROLE auth, read credentials/sessions, or execute credential lookup; pool contexts clear; bootstrap URL rejected |
| Migration/access/live probes | Existing login config preserved; local ready and zones HTTP 200; original 20-entry demo ledger independently verifies |
| Ruff / strict mypy / OpenAPI | Passed; generated contract includes only implemented public/identity routes |
| Web lint/types/unit/build and desktop/mobile browser regression | Passed; 4 web + 4 browser tests |

At the P03 checkpoint the UI was the welcome/community screen. These checks complete P03/T01 and
the identity portion of T02; permissions on future redistribution/report endpoints
and full T12 browser workflow remain to implement. Hosted CI remains unverified.
Reproduction and header/session policy: [IDENTITY.md](IDENTITY.md).

## Connected account UI and working controls

At the user's request, improved the existing Second Table design and connected all
rendered account/admin actions. No schema revision or package dependency was added.

- Welcome primary action now opens registration; role links preselect donor,
  receiver or volunteer. Header links reach the correct home sections from other
  pages. Account-aware navigation, readable labels, focus states and mobile forms.
- Registration uses paginated live zones, multiple requested roles, conditional
  receiver capacity, manual/geolocation coordinates and explicit success/sign-in.
- Secure session restoration, login/logout, editable persisted profile, actual area
  names, role approval status and refresh. No passwords/tokens in browser storage.
- Admin member filtering/pagination, expandable reviews, selected-role replacement
  and revocation with a required reason; backend zone/role enforcement retained.
- GET `/auth/session` provides nullable anonymous state without routine browser
  errors; authenticated DTO matches login, private/no-store. Expired/revoked/inactive
  sessions return null, while dependency failure is not treated as anonymous.
- Browser harness isolates writes in dbthon_browser_test, preserves demo/backend
  test databases, and uses an ephemeral synthetic admin password. No shared login
  or fake domain data appears in frontend source.

Observed checks: 66 backend tests (10 unit + 56 PostgreSQL/API), seven Vitest tests,
Ruff/strict mypy/OpenAPI drift and web ESLint/TypeScript/production build passed.
All eight Playwright checks passed against the real isolated API/database on
desktop/mobile: registration, password visibility, location, login, persisted profile,
direct-route guards, selected-role approval, revocation, logout, status refresh,
cross-page anchors and retry paths. No browser application errors or horizontal
overflow were observed. Final live welcome captures also had empty error/warning
lists at 1505x1045 and 390x844. `view_image` comparison against the retained design
covered palette, fonts, columns, timeline, controls, band, navigation and mobile
forms. Intentional account-entry/copy extensions and comparison details are in
[the design ledger](design/README.md). Total: 81 passing backend/component/browser
checks. Hosted CI remains unverified.

| Reproduction command | Observed result |
| --- | --- |
| `apps/api/.venv/bin/python -m pytest apps/api/tests --db -q` | 66 passed; resets only dbthon_test |
| `apps/api/.venv/bin/ruff check apps/api scripts/browser_test_server.py` | Passed |
| `apps/api/.venv/bin/mypy --config-file apps/api/pyproject.toml apps/api/app` | Passed |
| `apps/api/.venv/bin/python scripts/export_openapi.py --check` | Passed |
| From apps/web: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | Passed; seven component tests |
| From apps/web: `npm run test:e2e` | Eight passed in isolated dbthon_browser_test |
| `python3 scripts/validate_handoff.py` and `git diff --check` | Passed |
| `apps/api/.venv/bin/python scripts/database.py verify` | Original demo ledger: 20 valid entries; preserved |

Fixed a browser-discovered sign-out/route-guard race; logout and home navigation
now change together. A review-status test selector was narrowed to distinguish
the saved notice from the concurrently loading list.

P09 remains partial: listing/claim/delivery, inbox, trust and report screens cannot
be implemented against completed domain APIs yet. The UI renders working account
actions without inactive controls, seeded food counters or simulated success.
Full T12 claim-to-delivery and external notification evidence remain outstanding.

## Redistribution workflows and current checks

Revision `0003_workflows.py` / `database/0003_workflows.sql` adds guarded commands,
private worker routines, restricted trust summaries, task visibility, pickup
accepted_at and outbox UUID leases. Prior revisions are unchanged. New backend
modules: `app/workflows`, `app/routes/workflows.py`; frontend: `features/workflows`.
Worker/provisioning/test harness and OpenAPI are updated together.

- Donor create/edit/cancel, live ranked feed with capacity/5 km/same-zone filters,
  safe food detail, deadline warnings and whole-quantity idempotent claims.
- Coordinated donor/receiver cancellation, assignment races, composite attempt
  history, cancellation/replacement, server-time pickup/delivery and admin terminal
  failures. Delivered/picked-up food is never silently reallocated.
- Completion-only reciprocal ratings, average/count with null unrated score,
  participant contacts restricted to the exchange and per-user audit history.
- Real InApp delivery after commit, 30-second leases, crash recovery, bounded
  exponential retries/five attempts and owner-only read state. Repeat reads do not
  create extra state-change ledger entries. External channels remain unconfigured.
- Admin own-zone exchange review, member audit, UTC bounded day/zone/city reports,
  separate picked-up/delivered kg, labelled 0.4 kg estimates, null unsupported CO2e,
  participation/claim latency and filter-matched formula-safe CSV.
- Role-capability navigation, pending-role guidance, CSRF writes and retry-stable
  command keys. Dark mode and share links do not bypass existing authorization.

| Reproduction/check | Observed result |
| --- | --- |
| `apps/api/.venv/bin/python -m pytest apps/api/tests --db -q` | 79 passed in 60.90 s: 12 unit + 67 real PostgreSQL/API checks |
| Additional explicit-zone feed regression | Passed; ranking, filtering, pagination, privacy and server clock |
| Ruff / strict mypy / exported OpenAPI drift | Passed |
| Web ESLint / TypeScript / Vite build | Passed |
| Vitest | Eight passed, including retry key reuse after an ambiguous network failure |
| Final combined desktop/mobile Playwright | 16 passed in 2.0 min; homepage/theme/sharing and complete workflow/report regressions included |
| Restricted live feed EXPLAIN | [Captured plan](evidence/feed-plan.txt): 5 eligible synthetic rows, 7.736 ms execution; no planner hints. Small data only |
| Local migration and worker | Applied 0003; processed nine expired/missed listings and delivered 17 in-app updates; no retry failure |
| Independent local ledger verification after worker | 47 valid entries; existing registered users/profile/credentials preserved |

Integrated the explicitly approved concurrent deployment changes: exact-origin
credentialed CORS, production Secure/SameSite=None cookies, production PostgreSQL
TLS and configured browser API URL. Writes still require CSRF and idempotency
headers. CSV export uses the same configured URL/credentials; CORS exposes safe
Retry-After/request-ID headers. Four origin-policy unit checks pass, including
rejection of an untrusted origin and originless cross-site writes. The production
cookie database test substitutes the local non-TLS transport only; a separate
configuration assertion verifies production TLS remains required. Worker startup
accepts either a restricted URL or the deployment's component configuration.

The first combined browser report check hit its five-second UI wait. The report
query now materializes scoped RLS inputs once rather than repeatedly scanning them
per metric/bin. A same-data restricted-role diagnostic observed 136.876 ms execution
after this change (eight UTC bins, synthetic data); no global planner/JIT setting was
changed. The browser allows ten seconds for report rendering and verifies actual
data and matching CSV. This is small-data verification, not the P11 10k benchmark.

The first mobile run found touch hit-testing problems on the long form. Limited
smooth scrolling to section navigation and stacked native date/time controls at
narrow widths. Fresh mobile flow then passed without forced clicks. The browser
login helper honors actual Retry-After when account-switch tests reach the real
rate limit. Main/demo DB is preserved by all resettable tests; browser checks use
only dbthon_browser_test, including its isolated worker and ephemeral passwords.
Hosted CI remains unverified. The old checkpoint counts above are historical.

Homepage design/QA and final combined browser results are recorded in
[HOME_REFRESH.md](design/HOME_REFRESH.md). The handover image is illustrative,
not evidence of real users or impact. Temporary screenshots stay outside Git.

## Workspace usability iteration (2026-10-06)

Implemented in an isolated `feat/workspace-usability` checkout based on published
`8b77231`. Original working-tree AWS infrastructure, cost/deployment documents,
README/architecture links and uncommitted RDS compatibility migration remain local
and outside this app commit. No schema revision, cloud deployment or data migration.

- Shared `/dashboard` landing with preserved requested deep links, current-role
  shortcuts, exact database counts, five deadline-ordered active items and unread
  updates. Pending members get verification guidance; failures get retry without
  fabricated zero totals. `/account` remains settings.
- Forest/sage desktop grouped sidebar and mobile Dashboard / Tasks / Inbox / More,
  with native dialog dismissal, focus wrapping/restoration and approved-role tools.
  Breadcrumbs/parent links cover food, editor, exchange and audit views; originating
  URLs retain filters and correct destination labels for multi-role people.
- Authenticated `/workspace/overview`, existing restricted pools/RLS, no new grants.
  Delivered unread counts and permitted Donor/Receiver/Volunteer/Admin summaries
  query whole database sets independently of preview/page limits. Current approvals
  govern responses; changed capabilities refresh the browser session.
- Literal case-insensitive food search (80 characters, trimmed, parameterized and
  wildcard-escaped), normalized search bound into feed cursors. URL filters for food,
  exchanges, deliveries, members and inbox; cursor trails support Previous/Next,
  refresh/Back/Forward and direct-link Back to first page.
- Shared visible-tab overview polling every 15 seconds, return-to-tab refresh and
  invalidation after successful commands, notification reads and admin reviews.
  Searchable `/help` reuses existing FAQs and links to permitted role tools.

| Reproduction/check | Observed result |
| --- | --- |
| `DBTHON_TEST_DATABASE=dbthon_usability_test apps/api/.venv/bin/python -m pytest apps/api/tests --db -q --tb=short --maxfail=1` | 88 passed in 85.86 s, including exact/multi-role/pending/revoked/zone counts, preview limit, literal search and cursor compatibility; one existing Pydantic field-alias warning |
| `npm run test --prefix apps/web` | 12 passed; shared request/invalidation, hidden-tab polling, error/account isolation and capability revocation included |
| `DBTHON_BROWSER_TEST_DATABASE=dbthon_usability_browser_test npm run test:e2e --prefix apps/web` | 22 passed in 2.0 min, desktop 1505x1045 and mobile 390x844, real PostgreSQL/API and isolated worker |
| Follow-up browser `e2e/identity.spec.ts e2e/workflows.spec.ts` | Eight passed in 1.8 min after final breadcrumb correction, including member/audit and exchange/delivery filter refresh/return |
| Final browser `e2e/usability.spec.ts` and fresh visual captures | Six passed in 23.9 s; fresh desktop light/mobile dark renders inspected against retained concepts with `view_image`; paired themes and mobile menu were also inspected |
| Ruff / strict mypy | Passed; 23 backend source files type checked |
| Web ESLint / TypeScript / Vite build | Passed |
| Exported OpenAPI drift / handoff / whitespace | Passed |

Browser coverage includes default/deep-link sign-in, sidebar containment, role menus,
focus wrapping/Escape/restoration, breadcrumbs, food filters/search, history, real
23-listing Previous/Next/direct-link pagination, unread updates after reads, help
search/disclosures, dark mode, long content/no horizontal overflow and overview
outage/retry. Complete prior registration/approval/revocation and food-to-delivery/
rating/report flows remain covered. The suite preserves actual login throttling
and waits Retry-After; its intentional auth 429 is excluded from unexpected console
errors, with the error message and successful retry asserted.

Visual QA found and fixed a global nav rule making the sidebar horizontal; focus
QA prompted explicit wrapping in the native dialog. Search pagination initially
matched an existing bread fixture; its test was narrowed. Browser workflow tests
now search their unique food instead of assuming a first-page result. Concepts,
comparison ledger and intentional live-data differences are in
[WORKSPACE_USABILITY.md](design/WORKSPACE_USABILITY.md). Browser plugin unavailable;
installed Chrome/Playwright fallback used. Temporary captures are outside Git and
removed after inspection. Hosted CI and deployment are not verified by these checks.

## Next work

**P11 is the first unfinished task:** controlled four-zone week simulation, measured
10k-listing API benchmark, expanded clean-clone reproduction and course demo artifacts.
P12 requires actual donor/NGO interviews and pilot evidence. FR08 SMS/push and an
emissions factor need separate configuration/source evidence before completion.
Use [START_HERE.md](START_HERE.md) as the handoff prompt.

## Outstanding decisions / evidence

Implementation choices needed for the prototype are resolved in ADR 0001. No owner
input blocks P01. Real donor/NGO interviews, a pilot, source-statistic verification,
an emissions factor and an external notification channel are not supplied. License
selection and production deployment are later owner decisions. Initial repository
setup does not authorize paid deployment or contacting participants.

## Session update format for future contributors

Record date/commit, completed plan gates, changed modules/migration IDs, exact commands
and outcomes, partial requirements/known failures, and the next concrete task. Keep
requirements.json statuses and implementation-plan checkboxes aligned with evidence.

## Render website hosting preparation (2026-10-05)

Added root `render.yaml` for a Render static site built from `apps/web`, with SPA
fallback and `VITE_API_BASE_URL`. The frontend now supports an explicit API base URL
and credentialed requests. The AWS API now supports exact-origin credentialed CORS,
production cross-site session cookies and existing CSRF checks. Render service
`srv-db1u54ks728c73ab1bi0` is live at https://dbthon-26.onrender.com from GitHub
commit `324773bb734bd9329fca07e12543a35660026eca`. The homepage loads, but its
community API call fails: this deployed commit predates the API-base support, and no
AWS API URL/origin has been connected yet. The AWS public API URL is still required.

Observed checks: `npm run build` passed; `apps/api/.venv/bin/python -m pytest
apps/api/tests/test_identity_security.py -q` passed (4); `python3
scripts/validate_handoff.py` passed; `render.yaml` parsed with PyYAML; `git diff
--check` passed using the direct Command Line Tools git binary. The general `git`
launcher remains blocked by the Xcode license prompt. Render build logs showed two
moderate npm audit findings. Next: publish the reviewed frontend/API changes, set
`VITE_API_BASE_URL` and the AWS exact-origin allowlist, then verify community data,
deep-link refresh and sign-in against the live AWS API.

## Product hardening and consolidated-package preparation (2026-10-06)

Implemented in `/private/tmp/dbthon-usability` on `feat/product-hardening` from the
published usability baseline `b42bc0c`. The user's selected notification approach
is WhatsApp click-to-chat plus the existing in-app inbox. Exchange contacts now
open an encoded handover message for authorized participants; the member sends it.
No automated external notification delivery is claimed.

Changed API configuration/static serving, cookie configuration, request logs,
overview conditional responses, the complete-own-chain verification interface,
exchange/trust/food UI and tests. Added a non-root multi-stage Docker image, local
port launcher, replacement Render Blueprint, migration-source CI guard and
[hosting prerequisites](CONSOLIDATED_HOSTING.md). The
[hardening audit](PRODUCT_HARDENING.md) records all 15 review areas and unfinished
work. OpenAPI was regenerated. No schema migration was added.

| Actual command/check | Observed result |
| --- | --- |
| `DBTHON_TEST_DATABASE=dbthon_usability_test apps/api/.venv/bin/pytest apps/api/tests --db -q` | 91 passed against real PostgreSQL/PostGIS, including actor-scoped overview validators and catalog privilege checks |
| Same database pytest on identity/workflow tests with `-k 'secure_production_cookie or overview_etag'` after final contract/cookie updates | 3 passed, 42 deselected; HTTPS Secure cookies tested with both SameSite=None and Lax, rotation preserved, full-chain response model checked |
| `npm test --prefix apps/web` | 15 passed; conditional 304 reuse/account isolation and WhatsApp URL construction included |
| `npm run test:e2e --prefix apps/web` | 22 passed, desktop 1505×1045 and mobile 390×844; handover links/full-chain verification, workflows, navigation, dark mode, failure recovery and overflow assertions |
| Ruff / strict mypy / ESLint / TypeScript / Vite production build | Passed; mypy checked 24 application files |
| `npm audit --omit=dev --prefix apps/web --json` | Zero reported production dependency vulnerabilities; build tooling audit still reports 3 development dependency findings (1 moderate, 2 critical), not remediated in this iteration |
| Official Render JSON-schema validation of `deploy/render-single-platform.yaml` | Passed after quoting YAML scalar `off` and PostgreSQL version |
| Linux amd64 Docker image build | Passed with locked Python/npm dependencies and non-root runtime |
| Local container port 8080 mapped to loopback 18080 | Homepage/dashboard/help served the built SPA; API liveness returned JSON; unknown API route retained 404. No database credentials supplied and readiness remains closed |
| OpenAPI `--check`, migration source guard, handoff validation and `git diff --check` | Passed |

Browser screenshots were reviewed locally, including wrapped long listing names
on the 390px feed. The package check does not establish Render managed-role
compatibility, worker availability or live sign-in. The current bootstrap's
BYPASSRLS dependency is an explicit pre-provisioning gate. No cloud resources were
created, deployment performed, data moved or participant messages sent.

Original `/Volumes/Seagate/dbthon` AWS infrastructure, cloud scripts, deployment
cost documents, uncommitted RDS migration and working-tree documentation links
remain locally preserved. Next task: test/reconcile managed-role bootstrap on a
separate disposable database before building the synthetic public demo/reset.
P11/P12 remain incomplete; retention/deletion, external checkpoints, safety policy,
operational metrics/alerts, load evidence, Tamil/PWA and real interviews remain
pending as detailed in the audit.

## AWS backend and Render connection (2026-10-07)

Implemented in isolated `/private/tmp/dbthon-connect` from published `8356311`.
The user authorized RDS-managed owner credential rotation and AWS deployment.
The new `DbthonRenderApi` CloudFormation stack in `ap-south-1` is
`UPDATE_COMPLETE`. The retained RDS instance is available, PostgreSQL 17.11,
private and deletion-protected, with its managed owner secret active. The old
failed `DbthonPrototype` stack and original workspace drafts remain untouched.
No local member database was copied or replaced.

Changed: migration/SQL 0004, managed-owner role preparation and login provisioning,
Mangum dependency/lock, Lambda API/worker adapters, operator initializer, Linux ZIP
Dockerfile and CloudFormation template, adapter/cookie tests, and deployment/handoff
documentation. Migration 0004 adds sealed guard policies under FORCE RLS; it does
not disable role/zone checks or migrate user data. Owner credentials are restricted
to the private initializer. API and worker have separate restricted database logins.
See [deployment details](AWS_RENDER_CONNECTION.md).

Actual cloud initialization first failed on seed sequence UPDATE rights; the seed
transaction rolled back. Fixed temporary bootstrap sequence privileges, cleanup on
repeat invocation and saved-anchor reuse. RDS initialization then returned
`initialized=true`, `synthetic_seed_added=true`, `migration=0004`; its repeat returned
`synthetic_seed_added=false`. Restricted worker invocation succeeded. EventBridge's
minute schedule is enabled and CloudWatch records completed 50-second worker runs.
The synthetic fixture account passwords remain disabled; new public accounts remain
unverified until administrator approval. Public admin registration stays forbidden.
A production administrator login/onboarding workflow is still required before a
real pilot. No public shared demo password has been published.

Render static service `srv-db1u54ks728c73ab1bi0` at
<https://dbthon-26.onrender.com> has its merged `VITE_API_BASE_URL` set to
<https://4hdf76oz3c2uxe6hmunb2fgm6m0wluin.lambda-url.ap-south-1.on.aws/api/v1>.
Environment deploy `dep-db2klf8m7kps7392ar9g` is live. The service was missing the
repository's SPA rewrite: direct `/register` returned 404. Saved `/*` to
`/index.html` as a Rewrite through Render settings; direct routes and refresh now
work. The first browser assertion was ambiguous between two verification messages;
a retry's fixed fictional phone hit the uniqueness guard. Corrected the smoke
check's locator and used a unique fictional phone without weakening the app.
Two clearly synthetic test accounts were created; passwords were ephemeral, never
printed or committed, and the completed test session was logged out.

| Check / command | Actual result |
| --- | --- |
| `apps/api/.venv/bin/pytest apps/api/tests -q` | 14 passed, 80 database tests explicitly skipped |
| `DATABASE_URL=postgresql+psycopg://dbthon@127.0.0.1:55435/dbthon PYTHONPATH=apps/api apps/api/.venv/bin/pytest apps/api/tests --db -m database -q` | 80 passed, 14 deselected, 70.90 seconds; disposable PostgreSQL/PostGIS |
| `apps/api/.venv/bin/ruff check apps/api deploy/aws-lambda/bootstrap.py scripts/prepare_cloud_database.py` | Passed |
| `apps/api/.venv/bin/mypy --config-file apps/api/pyproject.toml apps/api/app` | Passed, 26 files |
| `python3 scripts/check_migrations.py` | Passed, four authoritative migrations |
| `python3 scripts/validate_handoff.py` | Passed; does not validate pilot outcomes |
| CloudFormation template validation and reviewed change sets | Passed; no database replacement; stack update complete |
| Linux amd64 Lambda ZIP build/import | Passed; final ZIP SHA-256 `f0655f1f4fee2386ceab799d3975239e4b3a47e5f5e9af00d4a5ba56a5bee099` |
| Non-superuser local initializer repeated | Passed; guard schema CREATE and sequence UPDATE both false afterwards |
| Live AWS `/health/live`, `/health/ready`, `/zones` | HTTP 200; restricted auth/runtime database checks succeed |
| Anonymous `/workspace/overview` | HTTP 401 |
| Live Render Chrome at 390x844 | Registration 201; login 200; dashboard and refresh session continuity; private me/overview 200; CSRF-free logout 403; valid logout 204; no account horizontal overflow |
| Production session cookie | Secure, HttpOnly, SameSite=None verified in Chrome |

Mangum emits a Python 3.13 event-loop deprecation warning in local adapter tests;
tests and deployed calls succeed. The existing frontend source was not changed in
this iteration; prior full UI suites remain historical evidence. Browser cookie
restrictions in other browsers remain a split-host limitation. No external messages
or cloud data migration occurred. Next task: administrator onboarding followed by
a separate synthetic public demo/reset workflow. P11/P12, monitoring/alerts, privacy
and food-safety work remain pending in [the audit](PRODUCT_HARDENING.md).

## Zone 1 fixture administrator login (2026-10-07)

The user authorized enabling the existing `z1.admin@example.invalid` account with
a supplied password. Added private `configure_fixture_admin` operator handling,
`app/core/operator.py`, three PostgreSQL security tests and the setup procedure.
The initializer accepts only an application-policy Argon2id hash, checks installed
fixture integrity and exact active/verified/approved admin identity and zone,
updates the password hash, revokes old sessions and appends a metadata-only audit
event in one transaction. It cannot promote public accounts or change roles/zones.
No password, hash, operator event, session token or authenticated response is saved
in Git. No schema migration or public route was added.

The reviewed `AdminOnboarding20261007` change set completed on `DbthonRenderApi`.
The deployed ZIP SHA-256 is
`196e636d74e11727e0467de77ba2c00bba740ab3d2bf9e62716a90d32e9e2964`.
IAM-only initializer returned `admin_login_enabled=true`, `user_id=104`, `zone_id=1`.
Live Chrome verified sign-in 200, Admin capability, the `/admin` Community members
screen and zone 1 member reads 200; zone 2 member access returned 404. The test
session was signed out (204). Remaining synthetic fixture logins stay disabled.

Checks: `DATABASE_URL=postgresql+psycopg://dbthon@127.0.0.1:55435/dbthon
PYTHONPATH=apps/api apps/api/.venv/bin/pytest apps/api/tests/test_operator_db.py --db -q`
passed all three tests (audit/session revocation, non-admin rejection, malformed
hash/inactive-admin rejection) against a task-only PostgreSQL/PostGIS container.
Unit suite: 14 passed, 83 database tests explicitly skipped. Ruff passed; strict
mypy passed 27 files; migration checker and handoff validator passed. The prior 80
full database tests remain the preceding release's evidence; this follow-up ran the
three affected database tests. Temporary test resources were removed after checks.

This enables the requested controlled-demo zone administrator; it does not approve
other members automatically or establish a real pilot identity-verification process.
Next task: separate synthetic public demo/reset workflow and the pending P11/P12
operational, privacy and food-safety evidence. Original workspace drafts remain
preserved.

## UI/UX release (2026-10-07)

Published `7e5750faa9809b919bcf9ad2624b0d3379c6de75` to GitHub `main`; verified the
remote ref matched. Render static service `DBTHON-26` auto-deployed that commit and
reported it live. Public `/`, `/help`, and `/food` each returned HTTP 200. The API
stack update retained existing resources and deployed the tested Lambda package;
the guarded bootstrap advanced the existing PostgreSQL database from 0004 to 0005
without fixture seeding, and Lambda readiness returned HTTP 200. No AWS drafts,
deployment cost documents, scripts, or the separate original-workspace RDS
compatibility migration were staged or moved. Detailed implementation and test
evidence: [UI/UX implementation record](UI_UX_IMPLEMENTATION.md).

The help and food search rows also received a follow-up alignment fix: their field
bottom margin no longer offsets adjacent controls. The focused desktop/mobile
browser check asserts the help input/button bottom edges align; both variants pass.


## Repository layout (2026-10-07)

Moved the application source to root `backend/` and `frontend/` directories. Updated
Render to build from `frontend/`, AWS container and Lambda packaging to load `backend/`,
CI, Make targets, shared scripts, and current development documentation. The SQL
settings/archive draft is revision 0006 after the existing listing-photo revision 0005.
AWS infrastructure drafts and cost/deployment documents remain in the workspace.

Checks for this structural change: `python3 scripts/check_migrations.py`,
`python3 scripts/validate_handoff.py`, `git diff --check`, and frontend production
build. Application tests were not rerun. Historical command records above intentionally
retain the paths that were used at the time.

## Community tools release (2026-10-07)

Implemented zone food requests and listing offers, versioned pickup agreements,
community announcements and curated partner links, member suggestions, and admin
review. The feature branch was integrated with GitHub `main`'s backend/frontend
layout and account-settings migration. Revision `0007` handles both paths: fresh
databases apply account settings at `0006` then community tools at `0007`; the
already-deployed database had community tables at `0006`, so the guarded `0007`
bridge applied the missing settings schema without recreating community data.

Observed checks: all 109 API tests passed against PostgreSQL/PostGIS; 25 Vitest
tests passed; four desktop/mobile Playwright cases passed for request-to-listing
offers and normal claiming, pickup agreement/rescheduling, and suggestion review
and publication. Python Ruff and strict mypy, frontend ESLint/TypeScript/build,
OpenAPI drift, migration-source and handoff validation passed. The migration bridge
was independently exercised on the allowlisted disposable `dbthon_usability_test`
database with community revision `0006` and no settings tables; it reached `0007`
with both schemas present. Frontend bundle measured 117,272 bytes gzip.

API publication: CloudFormation stack `DbthonRenderApi` completed its in-place
update. Lambda package SHA-256: `477770acb2cc356d473fc8c7c3f871dbc9d57d8b8897f20b23c98c8f5ff88df3`.
The operator-only migration returned previous revision `0006`, current revision
`0007`. Live readiness returned 200; anonymous requests, community updates and
notification-settings reads returned 401; CORS preflight from the configured
Render origin returned 200. The existing database, VPC, secrets and Function URL
were retained. GitHub and Render publication of the frontend are recorded below
once the final commit is live.
