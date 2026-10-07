# Donor reliability release review

Branch: `feat/donor-safety-alerts`. This is a source implementation awaiting runtime
regression and deployment review; it is not yet published to AWS or Render.

## Product behavior

- Daily donations: select a prior owned donation, daily time (India time in the UI),
  pause/resume and reopen a fresh listing form. Existing worker emits one due reminder.
  Donor checks quantity, timing, packing and ingredients each day before publication.
- New/edit listing forms ask how the batch is stored (hot/cold/ambient), whether it
  is packed, known allergens and optional halal/Jain/nut-free declarations. Repeat
  forms deliberately reset all declaration answers. Old API records remain explicitly
  undeclared rather than receiving fabricated confirmations.
- Details show the checklist; feed cards show known allergens and diet declarations.
  Feed filters bind to pagination. Allergy exclusion omits unknown checklists and is
  labelled as filtering declarations, not guaranteeing food is allergy-safe.
- Settings offers SMS/WhatsApp consent, channel configuration state and phone install
  guidance. The external worker has a single-recipient gate and default three-attempt
  daily cap. No provider account or phone receipt has been obtained.
- Manifest, 192/512 icons, service worker and offline guidance are included. The shell
  caches only public static assets; it does not cache account responses, phone contacts
  or food listings and cannot queue pickup/delivery writes. Assets are bounded to 30.
- Interview and one-collection worksheets are ready. No stakeholder conversation,
  quote, measured collection or pilot result is invented.

## Migration and release order

1. Review provider eligibility and costs; leave credentials/actual phone values out of Git.
2. Exercise `0010` and `0011` on a disposable PostgreSQL 17/PostGIS database, followed
   by the complete backend and relevant browser regression. Existing tests' truncate
   fixture includes new tables and the API inventory includes schedules.
3. Package/deploy bootstrap, invoke guarded migration, inspect the schema and check
   role permissions. Then deploy API/worker, retaining existing VPC/RDS and schedule.
4. Publish the frontend after its API schema is live. Verify CORS PUT for schedules,
   install/offline fallback, declarations/filters and pause/resume from actual screens.
5. If approved, configure one eligible demo number/provider securely, opt in, cause
   one real event and record provider acceptance plus observed phone delivery.
6. Conduct real conversations only with authorization and participant consent.

No new paid AWS service is necessary. Existing RDS/worker costs continue; optional
provider sends may consume trial units or money depending on the actual account.
Account trial eligibility, provider setup, observed delivery, runtime regressions and
pilot evidence remain open gates. See REAL_ALERTS.md for the transport limitations.
