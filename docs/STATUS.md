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

## Cross-zone bootstrap review and community area refresh (2026-10-07)

Integrated the deployed zone-repair revision 0008 after community revision 0007. The existing
`z1.admin@example.invalid` bootstrap account can review and delegate Admin access in
every zone; later Admins stay in their own zone. Existing registered accounts are
required to confirm or change area after sign-in. A zone change is blocked during an
active listing, claim or pickup, and historical listings retain their saved zone.
Fixture and migrated zone labels are Vellore Fort (632004), Sathuvachari (632009),
Shenbakkam (632008) and Katpadi (632007). New revision 0009 grants only the new review
flag column to the restricted runtime role and updates member-read RLS to use the
explicit zone-admin predicate. The readiness probe adopts the runtime role locally
before checking PostGIS, supporting NOINHERIT login accounts.

Observed combined checks: `DATABASE_URL=postgresql+psycopg://dbthon@127.0.0.1:55435/dbthon
DBTHON_TEST_DATABASE=dbthon_usability_test PYTHONPATH=backend
apps/api/.venv/bin/pytest backend/tests --db -q` passed all **110 tests** (103.01 seconds).
The exact migration chain was applied to a freshly recreated allowlisted disposable
database. Regression coverage includes zone confirmation, global bootstrap review,
ordinary-admin isolation, and pagination. Frontend Vitest passed 25 tests;
ESLint/TypeScript/build, Ruff/mypy, OpenAPI drift, migration-source and handoff
checks passed. The initial JavaScript bundle is 117,769 bytes gzip. One existing
Mangum event-loop deprecation warning remains. A later live inspection confirmed
the other session had applied its zone-repair revision 0008; that exact SQL and
loader are preserved, and the read-policy/grant corrections are a forward revision
0009. The current AWS template's independent BootstrapCodeKey is also preserved.
The exact combined fresh migration chain through 0009 passed all 110 backend tests
in 97.08 seconds. The integrated desktop/mobile community browser run passed all
four cases in 1.6 minutes, respecting the real login throttle's retry window.
The tested app is pushed to `feat/community-tools`. After the user paused the other
deployment session, two reviewed code-only CloudFormation changesets completed:
first the operator Lambda, then the API/worker and their existing schedule bindings.
The guarded migration returned previous `0008`, current `0009`; operator inspection
confirmed community tables and the review-column read grant. Both independent code
parameters now use the tested package SHA-256
`e4202995ff3f1464a7a7e932dcda03634e7c2d218b094bda9b46d104ad1d7761`.
The live API contract exactly matched `docs/openapi.json`; readiness returned 200,
anonymous requests/updates/settings returned 401, and the credentialed Render-origin
CORS preflight returned 200. No database, VPC or API URL replacement occurred.
Published application revision `7347550aca9471a29f717ac3f41d094a87b476f6` to GitHub
`main` without force; the remote ref matched. Render deployment
`dep-db35s415efls73c1u060` reported that revision live. Live `/`, `/requests`,
`/community/updates` and `/dashboard` returned 200, and the deployed frontend bundle
contains the community tools and configured AWS API URL. The new desktop/mobile
keyboard/dark-mode cases passed (2 tests, 11.9 seconds), including focused form
controls, keyboard destination activation, 390 px overflow checks and no serious or
critical axe findings. Together with the four workflow cases, six community browser
cases passed. Frontend lint/type checks also passed after adding that coverage.
The requested community release gate is complete. The original workspace's
infrastructure/cost drafts remain untouched. SMS/push delivery remains unconfigured;
P11 performance and P12 stakeholder/pilot evidence remain separate unfinished work.

## Donor reliability implementation (2026-10-07, awaiting release)

Prepared `feat/donor-safety-alerts` from `c81b7ea`: migration 0010 adds guarded
handling/packing/allergen/diet declarations and owned daily reminder schedules;
0011 adds WhatsApp consent, bounded external leases, atomic daily budget and
provider acceptance/delivery metadata. API/frontend changes include feed filters,
fresh per-batch checklist, recurring-donation pause/resume, SMS/WhatsApp settings,
manifest/icons, install guidance and a public offline shell. Interviews and a
one-collection worksheet are prepared under `docs/pilot/`; no real quotes or
pilot data were collected. Deployment review is in `DONOR_RELIABILITY.md` and
provider setup requirements are in `REAL_ALERTS.md`.

Observed static/build checks in `/private/tmp/dbthon-donor-safety-alerts`:

- `/Volumes/Seagate/dbthon/backend/.venv/bin/ruff check` on changed application,
  loader/bootstrap and supporting fixture/contract files: passed.
- `/private/tmp/dbthon-account-controls-latest/backend/.venv/bin/python -m mypy
  --config-file backend/pyproject.toml backend/app`: passed, 31 source files.
- `npm run typecheck`, `npm run lint`, `npm run build` from `frontend/`: passed;
  initial JavaScript 120,107 bytes gzip, within 204,800-byte budget.
- `python3 scripts/check_migrations.py`: passed, 12 authoritative SQL scripts.
- `python3 scripts/validate_handoff.py`: passed.
- OpenAPI regenerated and drift check passed; `git diff --check` passed.

The original checkout's old Python environment lacked Pillow/Mangum; static API
export/type checking used the existing complete isolated environment instead.
No new tests were added or run. PostgreSQL migration/role/concurrency, external
provider and browser/offline runtime checks remain required before release; prior
110/25/6 test results apply to the earlier community release only. No AWS migration,
provider credential change, external message, deployment or pilot action was
performed for this feature branch. The requested secret skill `aws-secrets-manager`
was not available; actual provider credential configuration remains pending.
Existing unrelated AWS drafts stay in the original workspace.

## 2026-10-07: researched community experience source implementation

Compared primary websites/help pages for Too Good To Go, OLIO, Food Rescue US,
Food Rescue Hero and FoodCloud. The source-linked gap analysis is in
[COMPETITOR_GAP_ANALYSIS.md](COMPETITOR_GAP_ANALYSIS.md). Added CE01–CE05 on
`feat/donor-safety-alerts` after the existing donor reliability extension:

- Private saved listings with feed/detail controls, sidebar page, bounded pagination,
  automatic status/expiry exclusion and no reservation/donor notification.
- Current-participant exchange chat with recipient snapshots, replacement-volunteer
  privacy, terminal read-only state, rate limits and generic inbox alerts.
- Listing/exchange/message reports, reporter history and scoped admin review. Admins
  see only selected reported-message evidence, cannot review their own reports, and
  outcomes have no automatic allocation/trust/safety effect.
- Own current-zone collected/delivered totals and role breakdown, retry deduplication,
  meal assumptions and fixture labels; no invented emissions/pilot measurements.
- Contact-free ICS pickup download after current three-party agreement, with stable
  UID/revision and explicit re-download guidance after rescheduling.

Changed: `database/0012_exchange_experience.sql`, Alembic loader, experience routes,
listing projections/model, error mapping, frontend experience/save components,
food/exchange views, routes/navigation/styles, API/database/domain/requirements/ADR
and plan docs, comparison, OpenAPI export. Existing fixture cleanup and API inventory
were maintained for the new schema/routes; no new tests were added or run.

Observed static checks:

| Command | Result |
| --- | --- |
| `ruff check backend/app backend/alembic/versions/0012_exchange_experience.py` | Passed |
| `python -m mypy --config-file backend/pyproject.toml backend/app` | Passed: 32 source files |
| `npm run typecheck` / `npm run lint` | Passed |
| `npm run build` | Passed; initial JS 123,677 bytes gzip, below 204,800 budget |
| `python scripts/export_openapi.py` and `--check` | Export refreshed; current contract check passed |
| `python3 scripts/check_migrations.py` | Passed: 13 authoritative SQL scripts with unique loaders |
| `python3 scripts/validate_handoff.py` | Passed: source/link/spec/fixture checks, not runtime evidence |
| `git diff --check` | Passed |

Tooling used the complete Python environment at
`/private/tmp/dbthon-account-controls-latest/backend/.venv/bin/python`, Ruff binary
`/Volumes/Seagate/dbthon/backend/.venv/bin/ruff`, and linked installed frontend
modules. Run from `/private/tmp/dbthon-donor-safety-alerts`; frontend commands run in
its `frontend/` directory. OpenAPI commands set `PYTHONPATH=backend`.

**Unreleased:** migrations 0010–0012 are not applied to production. No database,
application unit or browser tests were run in this session; SQL permissions,
concurrency, new paths and mobile interaction still require actual runtime checks.
The live site remains the earlier main release. External alerts remain disabled
without a provider account/consented recipient. No pilot conversations were invented.
Original AWS drafts are preserved in the main workspace.

**Exact next task:** execute migrations and the CE/DF release scenarios on disposable
real PostgreSQL/PostGIS, exercise privacy/replacement-volunteer/report scope/retries
and own totals, complete browser/regression checks, then review release and deploy
database/API before frontend. P11/P12 remain open.
### 2026-10-07 - Second Table logo

Added a reusable plate, sprout and shared-table SVG mark to the header and footer,
plus a matching forest-green browser favicon. The inline mark inherits the wordmark
color and scales with its typography. No API or database changes are required.
Frontend lint, TypeScript and production build passed. A local Chrome visual check
at 1440 px/light and 390 px/dark confirmed both marks render, their vertical centers
match the wordmark, no horizontal overflow occurs, and no page errors occur. The
session endpoint was mocked as signed out for this presentation-only check. Browser
plugin was unavailable; regular Playwright was used. Screenshots are saved outside
Git at `/private/tmp/second-table-logo-desktop.png` and
`/private/tmp/second-table-logo-mobile-dark.png`.

### 2026-10-07 - Simplified workspace navigation

Reduced desktop navigation to Dashboard, Inbox, approved day-to-day food tools and
Community updates. Relocated saved listings, impact, reports and recurring reminders
into Personal tools; grouped administration and account/help in native keyboard
accessible disclosures. A group containing the current route opens automatically.
The sidebar is 250 px wide; role restrictions and mobile Tasks/More remain intact.
Changed `AppLayout.tsx` and `styles/workspace.css`; no migration or API changes.
ESLint, TypeScript and production build passed (124,009 initial JS bytes gzip).
Fixture-session Chrome checks passed for all-role desktop/light, 390 px mobile/dark,
and pending-member desktop: disclosure keyboard toggling, role visibility, unread
badge, mobile Tasks/More access, Escape focus restoration and no horizontal overflow
or page errors. Temporary QA script/screenshots are outside Git under
`/private/tmp/check-second-table-navigation.mjs` and
`/private/tmp/second-table-sidebar-*.png`. These are presentation checks, not new
backend/database feature evidence. Next unfinished project work remains the real
PostgreSQL/browser release gates for migrations 0010-0012 recorded above and P11/P12.

### 2026-10-07 - Stable selected sidebar labels

Removed the selected sidebar link's font-weight change. The sage highlight and
`aria-current` still identify the current page while label width stays stable.
Chrome fixture-session checks in light and dark modes clicked Community updates:
the label stayed one line and link height remained 43 px before/after selection.
Frontend lint, types and build passed. Only workspace navigation CSS changed; no
API or schema changes. Reproduce presentation check with
`node /private/tmp/check-sidebar-selection.mjs` while local Vite serves port 5175.

## 2026-10-07: live experience backend and themed dropdown repair

The user's screenshots showed My impact, Saved listings, My reports and Recurring
donations failing. Read the live public OpenAPI contract: all corresponding new
routes were absent. The frontend had reached Render before the matching AWS release.

Applied the matching operator package through reviewed CloudFormation change set
`ExperienceBootstrap0012Fixed`, retaining the previous template and other parameters.
The operator migration returned `previous_migration=0009`, `migration=0012` without
an error. Then reviewed/executed `ExperienceApi0012`, updating existing API/worker
code and their schedule references; the stack returned `UPDATE_COMPLETE`. Artifact
SHA-256: `adadb62d296860256eb2d7d44de84ef930253267c1976082fd49045d664eeb6d`.
No replacement database, network or compute topology was provisioned.
Live OpenAPI now includes all four screenshot page routes; readiness returned 200
and anonymous requests to the protected routes returned 401. Operator inspection
confirmed revision 0012, existing community tables and restricted review grants.
Authenticated cloud journeys were not exercised with a real member's credentials.

Before applying 0012 to production, corrected its report command's ambiguous `body`
parameter references. The issue was found on disposable PostgreSQL by reporting a
specific exchange message. Also corrected operator migration progression from 0011
to 0012 and maintained browser fixture cleanup for the new FK tables. Revision 0012
is now deployed and must only be changed through a new forward migration.

Dropdown repair covers every native `select`, including controls outside `.field`:
shared theme colours, border/radius, 46px minimum height, chevron with dark variant,
option colours, focus/disabled states and native keyboard/mobile behavior. Added
spacing to period/status filters and themed unwrapped report/chat textareas. Replaced
hardcoded experience-card borders with the theme line token. Sidebar donation links
use exact matching so schedules and donations are not simultaneously active.
Preserved concurrent main commits for the logo and grouped secondary navigation.

Observed checks:

- Existing backend regression: **110 passed** in 94.75s on allowlisted disposable
  `dbthon_usability_test`. An initial run incorrectly injected all root environment
  settings and caused two no-database checks to fail; rerunning with only POSTGRES_*
  inputs corrected the setup. No application change was needed for those failures.
- Focused real-PostGIS diagnostic: new page reads, saved-listing projection, daily
  schedule save, claim/pickup agreement, participant chat, admin chat denial, selected
  message reporting and scoped admin review passed. No production fixture reset.
- Existing frontend unit tests: **25 passed**. Existing desktop/mobile usability
  Playwright suite: **6 passed** in 21.1s. Lint, TypeScript/build and migration/handoff
  checks passed. Final initial bundle after latest main integration: 124,038 gzip bytes.
- Targeted Chrome diagnostic rendered the actual My impact page, changed 30 to 90
  days with a successful API response, checked light/dark styles at 1505px/390px,
  rendered all other screenshot pages without errors, and verified one active sidebar
  destination. Screenshots and rerunnable diagnostic are saved locally under
  `/private/tmp/dbthon-experience-release/` (`ui-launch.py`, `ui-check.cjs`).
  Browser plugin skill was unavailable; used installed Chrome through Playwright.

Reproduce regression with the configured local PostGIS and complete environment:
`DBTHON_TEST_DATABASE=dbthon_usability_test python -m pytest backend/tests --db -q`,
`npm run test --prefix frontend`, `npm run build --prefix frontend`, and
`DBTHON_BROWSER_TEST_DATABASE=dbthon_usability_browser_test npm run test:e2e --prefix frontend -- usability.spec.ts`.
The targeted diagnostic explicitly uses synthetic credentials and allowlisted browser
DB only; its screenshots contain synthetic fixture data, not pilot evidence.

Frontend fixes are prepared for main's existing automatic Render deployment. SMS/
WhatsApp remains disabled without provider setup; P11/P12 evidence is still pending.
Further new-feature concurrency/rate-limit/privacy edge cases remain follow-up
coverage, separate from the observed regression and targeted diagnostic above.
### 2026-10-07 - Routine and impact page alignment

Corrected shared workspace heading flex shrink so long titles/introductions stay
inside the content area. Recurring donations now has separate aligned reminder and
saved-schedule panels, stacked below 1100 px with readable form guidance and section
gaps. My impact uses the shared labelled field styling for its period selector and
a bounded two-column statistics panel with aligned values and wrapping notes.
Changed DonorSchedules.tsx, PersonalImpactPage in Experience.tsx and workspace.css;
no API/schema changes. Frontend lint/type/build passed. Chrome fixture-session
presentation checks passed for both pages at 1440, 1000 and 390 px, including dark
mobile, heading containment, no horizontal overflow, aligned desktop panels/statistic
rows and working listing/period dropdowns. No page errors were observed. Reproduce
with `node /private/tmp/check-workspace-spacing.mjs` against local Vite port 5175;
screenshots are `/private/tmp/workspace-{impact,schedules}-{1440,1000,390}.png`.
The newer remote dropdown and backend release evidence above is preserved.
