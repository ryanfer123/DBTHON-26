# NomNom frontend redesign and migration plan
Branch workflow: refresh the local `frontend` branch from the project base before
developing. The available base branch is `main` (there is no `min` branch). The
frontend branch was fast-forwarded from `d3c0349` to the updated `origin/main`
`c89c159`, preserving local changes; this base includes the repository move from
`apps/web` to `frontend/` and from `apps/api` to `backend/`.

The reference website is the public business/landing page. After sign-in, users
continue to their role-specific work area (receiver, giver/donor, or volunteer).
The work areas share NomNom's brand and design tokens, with quieter task-focused
visuals than the expressive landing page.

Date: 2026-10-07
Status: implementation in progress.

## Execution update (2026-10-07)

The reference assessment and the existing UI/UX review were checked before work began.
The UI/UX implementation record documents the previously shipped workflow enhancements
(map/list feed, presets, trust at decision points, exchange stepper, status/freshness,
impact charts, photo handling, accessibility and bundle budget). These remain in place.
The migration is frontend-only: no backend, database, schema, API, or deployment
changes. The public landing page takes the reference's visual ambition; role work
areas stay calmer. User-approved component designs are change-controlled in
[APPROVED_DESIGNS.md](design/APPROVED_DESIGNS.md), as required in `AGENTS.md`.
Checks and limitations are recorded below and in `docs/STATUS.md` as they are run.

Implemented in the current pass: NomNom shell and shared token restyle, an editorial
public landing with procedural Three.js/WebGL2 produce artwork, a pinned
GSAP/ScrollTrigger story synchronized with Lenis on wide screens, mobile and
reduced-motion static layouts, graceful WebGL fallback, and single-role workspace
routing after sign-in. Existing role APIs, workflow components, and security guards
remain connected. `frontend/` typecheck, lint, unit tests (31), production build
(114,700-byte gzip initial JavaScript), targeted formatting, and handoff validation
pass. Full app browser journeys and visual screenshot comparison remain unverified:
local `.env`/backend virtualenv are absent, and the in-app browser blocked local-host
navigation in this session. No API/database changes were made.

## 1. Purpose and recommendation

Build a complete, high quality NomNom frontend that takes the visual confidence,
editorial typography, image composition, motion restraint, and clear action hierarchy
from the retained More Nutrition reference while keeping NomNom's own service
identity and working workflows. Treat the reference as visual and interaction
inspiration, not as a code or product template. It is a Webflow/commerce campaign page;
NomNom is a React application for time-sensitive food exchange, role-specific
operations, privacy-sensitive accounts, and audited transactions.

This is a staged redesign of the existing application, not a frontend-only mock or a
rewrite of the server. The existing React 19, TypeScript, Vite, React Router, API
integration, and responsive role workspace are a working base. First establish a new
design system and shared shell, then migrate screens by user journey while retaining
the current routes, API shapes, authorization checks, and guarded command semantics.
Do not start by replacing the app wholesale or porting the campaign page's vendor
bundle.

## 2. Repository and product understanding

NomNom redistributes verified surplus within a local zone. A donor creates an
available food listing; an eligible receiver discovers and claims the whole listing;
a volunteer accepts a pickup and records pickup/delivery; participants can rate a
completed exchange; zone administrators verify members and inspect scoped reports.
The app also has registration/sign-in, profile, inbox, trust history, help, public
impact, and a shared role-aware dashboard. The source brief's “decentralized” wording
does not mean blockchain or independently available databases: the implementation is
a modular React/FastAPI app with a shared PostgreSQL/PostGIS store and logical zone
scope.

The current frontend is not a blank slate. Route definitions in `frontend/src/App.tsx`
cover `/`, community role links, sign-in/register, dashboard/help/account/admin,
donations and editor, food feed/detail, claims/detail, deliveries, inbox, trust, admin
exchange review, impact, and user audit. `AuthProvider`, `AccountGate`, `OverviewProvider`,
`AppLayout`, and `Workspace` provide session, role gating, shared overview state,
navigation and mobile menus. Feature code is organized under `features/community`,
`features/identity`, and `features/workflows`; styling is split into shared and feature
CSS. Leaflet is loaded for explicitly opened maps. The home page already has a custom
photographic/editorial design, light/dark theme, guidance, FAQ, public impact and
role-aware actions. The workspace has pagination/filter URLs, server-anchored time,
stale-data recovery, listing photos/maps, exchange status, CSV reporting and tested
mobile navigation.

The API is an existing, deployed contract. In particular, frontend actions must keep
CSRF and idempotency handling; claim and delivery actions wait for server confirmation;
all countdowns are advisory to database time; permissions are checked on every request;
participant-only contacts/directions remain private; and picked-up versus delivered
impact and synthetic-data provenance must stay explicit. Avoid a visual redesign that
weakens loading/error/empty states or invents successful external notifications,
food-safety certification, emissions factors, stakeholder results, or impact.

The repository's next implementation-plan milestone is P11 controlled-demo and
performance evidence, followed by P12 real stakeholder/pilot evidence. This visual
redesign is a separately requested frontend initiative. It should use available
synthetic fixtures and avoid changing those evidence gates.

Since the first repository review, `main` added the `/choose-zone` and `/settings`
flows and moved the frontend/backend into root `frontend/` and `backend/` directories.
These are part of the baseline now and must retain their behavior and API contracts.

## 3. Reference-site analysis

### 3.1 What the retained reference is

`references/More Nutrition - Matcha meets Protein.html` is a saved Webflow-rendered
marketing/product campaign page, with its sibling `_files` directory holding the
captured CSS, scripts, SVGs, WebP assets, and canvas-sequence artwork. The HTML has
Webflow `data-wf-*` attributes and loads Webflow's generated stylesheet from the
Website Files CDN. It also bootstraps an `app.js` bundle and a stylesheet from
`morematcha.vercel.app`. The local capture includes GSAP core and plugins, jQuery,
Lottie player/animation content, and references to animation code. The capture and
the existing assessment report identify GSAP/ScrollTrigger, SplitText, DrawSVG,
CustomEase, Inertia, Lenis, Swiper, Lottie, and a canvas frame sequence. Treat this as
an observed/inferred inventory of a saved page, not an audited source repository:
the page does not provide a clean source map, dependency manifest, licensing record,
or verifiable full production build. The earlier assessment report's stack table is a
useful lead, but its exact version/configuration and which library owns every visible
behavior cannot be confirmed from this static capture alone.

### 3.2 Observed visual and interaction patterns worth translating

- Strong branded opening with large custom display treatment and a single primary
  action; each screen establishes one clear next step.
- Large, art-directed image/product composition paired with short supporting copy.
- Generous whitespace and clear section pacing rather than dense dashboard grids.
- Fluid type and spacing, responsive layout transformations, custom SVG marks,
  hand-drawn accents, and a consistent set of button treatments.
- Motion follows a story: entrance reveals, scroll-linked transitions, drawing paths,
  kinetic typography, lightweight wobble, and a synchronized variant carousel.
- Long-page conversion journey uses repeated contextual calls to action and a clear
  end-of-page close.

### 3.3 What should not transfer literally

The reference optimizes commerce conversion and brand spectacle; NomNom must
optimize trust, quick task completion, legibility, and accurate status. Do not import
its product claims, Shopify links/tracking, testimonials, payment marks, autoplay
video, false or irrelevant urgency, preloader gate, product carousel,
or unowned visual assets. Create an original, story-driven scroll-scrubbed sequence
for the NomNom landing page, with a pinned desktop story and native, ordinary scrolling
on narrow screens or when reduced motion is requested. Keep motion scoped to public
marketing routes; operational views use restrained transitions. Avoid hiding
functional controls until animations complete. Reduced-motion users, keyboard users,
low-powered phones, flaky networks, and assistive technology must retain a complete
and understandable workflow.

### 3.4 Proposed visual translation for NomNom

Retain the existing forest/sage/orange identity, but raise its craft:
more deliberate display/body type scale, an explicit spacing and radius system,
consistent iconography, polished empty/loading/error feedback, better imagery with
documented rights/provenance, and a more confident workspace hierarchy. Use the
reference's spacious storytelling on the public homepage and concise hierarchy on
operational pages. Keep data lists scannable and actions close to the relevant item;
do not turn the app into a portfolio landing page or bury the next operational step
under large animated sections.

## 4. Goals and non-goals

### Goals

1. A cohesive, premium-quality visual system across public, identity, task, and admin
   surfaces, not only a redesigned home page.
2. Faster comprehension of the next role-specific task and time-sensitive exchange
   state, including smaller screens.
3. Preserve functional parity for every currently implemented route and action.
4. Improve accessibility, responsive behavior, rendering performance and maintainability
   as visible acceptance criteria.
5. Keep API/backend/security/impact semantics unchanged unless a separately justified
   backend requirement is raised and documented.

### Non-goals

No literal Webflow migration or copied vendor bundle, Shopify, Vercel runtime
dependency, paid GSAP plugins, or replacement of the frontend with design-only fake
data. Three.js/WebGL and GSAP/ScrollTrigger/Lenis are explicitly in scope for original
landing-page art and motion. No pre-made 3D model is available; create a small
procedural produce composition and provide a static/fallback rendering. Backend and
database changes are out of scope: this initiative is frontend-only and improves the
UI while preserving existing API integration.
native app/PWA scope, live chat, push/SMS provider, or rewrite of completed workflows.
No redesign work should be presented as P11 benchmark, stakeholder validation, or P12
pilot evidence.

## 5. Proposed experience and route coverage

| Surface | Routes | Redesign direction and required behavior |
| --- | --- | --- |
| Public | `/`, `/community/:role` | Art-directed but fast-loading hero; plain purpose statement; accurate three-step workflow; role-specific entry; public impact with synthetic provenance; FAQs/help. Keep API-provided role content and working deep links. |
| Identity | `/sign-in`, `/register` | Calm, clear forms with progressive role-specific fields, accessible errors, zone selection, capacity and location explanation, pending verification status. Preserve CSRF/session flow and safe return URLs. |
| Shared workspace | `/dashboard`, `/help`, `/account` | Strong page heading/context, role task summary, upcoming work and unread updates; shared shell; useful help search; clear profile and approval controls. Keep conditional overview/ETag behavior and retries. |
| Donor | `/donations`, `/donations/new`, `/donations/:id/edit` | Fast listing flow, high visibility for quantity/time/expiry, pickup location, photo upload and listing history. State that donor-entered expiry is not safety certification. Preserve command idempotency and location privacy. |
| Receiver | `/food`, `/food/:id`, `/claims`, `/claims/:id` | Discoverability first; urgency, distance, quantity, capacity, donor trust, eligibility and deadline readable together; map optional; clear whole-listing claim/cancel and 409 recovery. Never imply a claim before server success. |
| Volunteer | `/deliveries`, `/claims/:id` | Immediate next task, schedule, participant-only contact/directions, deadline strip, accessible progress stepper, pickup/delivery confirmation and failure paths. Keep `(claim_id, pickup_id)` distinct in routes/state. |
| Community | `/inbox`, `/trust` | Readable notification states and safe, redacted trust events. Explicitly distinguish in-app delivery from unconfigured SMS/push. |
| Administration | `/admin`, `/admin/exchanges`, `/admin/impact`, `/admin/users/:userId/audit` | Efficient zone-scoped member review, audit and reports. Put date/zone filters and export alongside summaries; separate picked-up/delivered measures and label all estimates/factors. Never suggest a global scope. |

Every route needs loading, empty, error/retry, unauthorized/pending, success, and stale
data designs where applicable. Route title, breadcrumbs, back/parent destinations,
URL filters, pagination history, keyboard focus, mobile nav, dark theme and not-found
behavior are part of the experience, not optional polish.

## 6. Recommended technical direction
where is three.js, webgl, and other tools I demanded as per the reference website?

Keep React 19 + TypeScript + Vite + React Router and the current API client/data flow.
The reference justifies design qualities, not a framework swap. Before adding a UI
library, animation framework, chart library, icon package, or font provider, verify
that it solves a concrete gap and fits the existing bundle budget and lockfile policy.
The app currently has a 200 KB gzip initial JavaScript budget, a lazy Leaflet chunk,
and a tested SVG charts implementation; preserve or improve those constraints.

Establish a documented token layer for color (light/dark/semantic), type, spacing,
container widths, radii, borders, elevation, focus, motion and breakpoints. Define
reusable primitives for buttons/links, fields, labels/help/errors, status chips,
alerts, cards/sections, data rows/tables, skeletons, empty states, dialogs, breadcrumbs,
page headers and task actions. Maintain native semantics and explicit accessible names.
Use CSS custom properties and responsive `clamp()` where it improves fluid scaling,
with content-driven breakpoints for actual layout changes. Keep CSS feature-scoped and
avoid a second styling system.

Use CSS transitions/keyframes for small decorative movement, transforms and opacity
only. The landing-page story may use GSAP/ScrollTrigger, Lenis for synchronized
scroll-scrubbing, and a lazy-loaded Three.js/WebGL2 scene. Dynamically load these
modules only on the public landing route, provide static content when WebGL is
unavailable, pause rendering offscreen/when hidden, cap rendering resolution, and
respect reduced motion and narrow layouts by disabling pinned/scrubbed motion. Do not
animate status or urgency solely by color or movement. No full-screen preloader.
Lazy-load optional map/media and keep meaningful content available before those assets.

Use local, optimized and licensed image assets with intrinsic dimensions, responsive
variants and a small mobile transfer target. Existing local WebP photo can be retained
if still suitable; reference-site assets must not be copied into production without
rights/brand approval. Public artwork is not evidence of real participants.

## 7. Migration strategy and work packages

### Phase 0 — Baseline and design decisions

- Capture a route inventory and current UI screenshots at desktop (1505×1045) and
  mobile (390×844), in light/dark mode and representative pending/approved/error
  states. Capture existing workflows before changing styles.
- Audit shared components, CSS cascade, accessible behaviors, test coverage, route
  deep links, image/font bytes and current build budgets. Record current baseline rather
  than assuming older historical test results represent today's working tree.
- Agree a small design brief, updated visual references, color/contrast tokens, type
  choices, image rights/provenance, motion principles and page wireframes. The retained
  reference alone cannot resolve every NomNom brand decision.
- Create a route-to-component/API/action checklist and baseline known issues. Do not
  change existing behavior to fit a screenshot.

### Phase 1 — Foundations and shared shell

- Implement tokens and component primitives alongside, not as an immediate replacement
  of, existing classes. Establish consistent focus rings, form validation, status and
  alert patterns in both themes.
- Redesign header/footer and authenticated workspace shell: desktop navigation,
  approved-role links, mobile dashboard/tasks/inbox/more menus, breadcrumbs, page
  headings and responsive content container.
- Preserve AuthProvider, AccountGate, OverviewProvider, role gating, route matching,
  browser history, title metadata and next-route behavior. Remove duplication only
  after component-level parity is shown.
- Exit gate: the shell works on all protected routes, keyboard and mobile navigation
  are intact, direct route refresh works, no API or authorization changes are needed.

### Phase 2 — Public and account entry

- Recompose the public homepage using the reference's art direction: strong hero,
  concise message and primary entry, local community workflow, trustworthy impact,
  role entry/help and a restrained footer. Preserve accurate content and existing
  role-aware destinations, theme preference, public API and share behavior.
- Refresh sign-in, registration, profile and verification screens with a common form
  system. Keep field names, validation, CSRF, cookies, no-store behavior and pending
  role explanation unchanged. After successful sign-in, route a single-capability
  member directly to `/donations` (Donor), `/food` (Receiver), `/deliveries`
  (Volunteer), or `/admin` (Admin). Honor safe requested deep links; leave multi-role
  members on `/dashboard` to choose their workspace.
- Exit gate: complete anonymous register/sign-in/session/logout and account update
  flows remain usable at keyboard and mobile sizes; public demo-data status stays clear.

### Phase 3 — Donor and receiver vertical slices

- Redesign donation list/create/edit/detail and receiver feed/detail/claims together.
  Settle card/list density based on content tests; show eligibility and time clearly;
  keep text-first fallback if photo/map fails.
- Preserve location picker fallback and OSM attribution, listing photo bounds, URL
  search/radius/category/capacity filters, feed cursor scope, stable Previous/Next,
  server clock offset, polling/stale state, 409 refresh, idempotency key lifecycle,
  claim privacy and exact backend copy/units.
- Exit gate: publish/edit/cancel, feed filters/search, page history, detail/claim,
  ineligible rows, conflict and failure recovery work against actual API responses.

### Phase 4 — Volunteer, community and admin journeys

- Redesign delivery queue and exchange detail around the next legal action and current
  attempt. Rehearse missed/replacement attempts and composite IDs; expose contacts only
  to authorized participants.
- Update inbox, trust, help and public impact with the new primitive system.
- Update zone member review, exchange review, impact charts/table/export and audit
  detail without changing scoping, filters, source rows or estimate labels.
- Exit gate: acceptance/pickup/delivery/rating, cancellations/failures, inbox read,
  verification/revocation, scope-denial, filtered reports and CSV match the current
  API contract and visual language.

### Phase 5 — Consolidation and release readiness

- Remove superseded CSS and components only after route parity and evidence exist.
  Keep implementation slices small and reviewable; no silent migration rewrites or
  API contract edits.
- Run existing unit/component, lint/type, build, browser, accessibility and API-backed
  workflow checks. Add tests only for identified changed behaviors and regression
  risks; do not represent screenshot snapshots as workflow validation.
- Review screenshots at desktop/tablet/mobile and both themes; check contrast, zoom,
  keyboard, reduced motion, long text, empty/error states, horizontal overflow and
  slow/failed asset paths. Inspect browser console/network for runtime errors.
- Compare initial gzip JS, largest lazy chunk, homepage images and mobile LCP/CLS
  against existing budgets; document deviations and measured results.
- Update UX/design/frontend docs and `docs/STATUS.md` with exact changes, route
  coverage, migration IDs (none expected), actual checks, known limitations and next
  task. Run `python3 scripts/validate_handoff.py` for documentation changes.

## 8. Acceptance criteria

- All current public and authenticated routes remain reachable by direct URL and refresh.
- Every existing end-to-end user journey remains connected to the real backend, with
  no fake successful actions or removed race/error handling.
- Existing API, database, security and impact invariants above are preserved; no
  migration or endpoint change is made as an incidental frontend redesign.
- Desktop and mobile layouts work at minimum 390px viewport width, remain usable at
  zoom/reflow, and support current dark-mode persistence.
- Every interactive control has an accessible name, visible keyboard focus, logical
  focus order and state announcement; serious/critical automated accessibility issues
  are resolved, while manual keyboard checks cover modal/navigation/forms.
- Reduced-motion preference removes nonessential movement; no interaction depends on
  animation completion, hover, color alone, or map/photo availability.
- No cross-zone/member contacts or coordinates leak; no password/session material is
  exposed; public and admin metrics keep correct scope and provenance labels.
- Production initial JavaScript remains within the existing 200 KB gzip budget and
  images remain optimized. Actual checks and limitations are recorded in STATUS.

## 9. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| A marketing page's visual density overwhelms time-critical task screens-firstpage_is_advertisement/business_purpose_needs_to_be_as_visually_rich_as_possible_exactly_like_reference_website                 | Use the full editorial treatment primarily for public content; keep workspace hierarchy task-first and data scannable.    |
| Rewriting shared CSS breaks distant routes and dark mode | Add tokens/components incrementally, migrate by vertical slice, capture before/after states and delete old styling only after parity. |
| Motion delays content or harms accessibility/performance | Keep essential content immediate, disable pinned/scrubbed motion on mobile and for reduced motion, keep operational routes native and still, and measure CPU/bundle. |
| Visual polish hides role, scope, expiry or eligibility semantics | Treat API/domain rules as design acceptance criteria; review each state and copy with role/domain requirements. |
| Broad redesign changes workflow behavior or security boundaries | Keep server contract fixed; reuse existing identity, route guards, API calls and command helpers. |
| Reference assets or fonts lack license/fit | Use original/local assets with provenance and approved licensing; do not copy production images or brand marks by default. |
| “Complete frontend” is mistaken for completed project evidence | Keep P11/P12, live provider delivery, pilot and TRL status unchanged unless separately evidenced. |

## 10. Recommended delivery order

1. Review this plan and approve the design direction/assets; prepare route-state
   screenshots and interaction inventory.
2. Produce design tokens and responsive shell prototype in the existing app.
3. Migrate public/identity, then donor/receiver, then volunteer/community/admin in
   complete API-backed vertical slices.
4. Consolidate styles, verify changed journeys and accessibility/performance, update
   the implementation/status evidence, then prepare the frontend for the separate
   P11 controlled demonstration.

Implementation proceeds from the completed repository/reference review into the shared
visual foundation and current route surfaces. Do not mark the migration complete until
the remaining Phase 5 checks and responsive visual review have observed results.
