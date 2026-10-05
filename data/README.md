# Data inventory and fixture contract

## Supplied data

The only supplied project artifact is the original 16-page PDF in docs/source.
There is no external dataset, production DB, interview collection or pilot log.
The source manifest records its origin, size and SHA-256; the page-labelled
extraction and three diagram pages retain content that text extraction misses.

## Synthetic demo fixture

[fixtures/demo.json](fixtures/demo.json) is a deterministic, fictional dataset:
4 zones, donor/receiver/volunteer/admin accounts, verified and pending roles,
capacity differences, available/future/expired/cancelled/claimed/picked-up/delivered
listings, claims, pickup retry history and reciprocal ratings. Names are generic,
emails use `.invalid`, phone numbers use fictional 555 ranges, and coordinates are
approximate hypothetical demo pickup points. This is not stakeholder evidence.

Timestamps are **integer minute offsets from an import anchor**, not fixed dates.
The future importer must accept a UTC `--anchor` or `--anchor-now`, materialize all
`*_offset_min` fields, and record the chosen anchor in demo/test evidence. Fixed
offsets let the same fixture remain meaningful months later. Status consistency is
defined at that anchor; live actions naturally change it afterward.

No login passwords, session values, notifications marked as sent, or invented ledger
hashes are supplied. The importer must require a locally supplied demo-password
input or generate credentials for the disposable local environment, hash them, and
avoid storing raw values in Git. Generate ledger events through the real append
service, not by inserting fictitious chain rows. Match demo IDs through a stable
seed mapping or preserve explicit IDs and advance identity sequences safely.

`expected_at_anchor` contains hand-computed baseline analytics and visible listing
IDs for the primary receiver; use it for meaningful reconciliation tests. Listing
seeds are directly normalized records. Do not expose seed-only IDs/offset fields as
public API payloads.

## Real-world evidence collection

Use [stakeholder validation template](../docs/deliverables/stakeholder-validation.md)
for actual interviews. Keep raw contacts, consent and precise personal locations in
ignored `data/private/`. Commit de-identified findings only with permission. The
week-long synthetic simulation proposed in TESTING.md must be labelled as simulated.
No emissions factor is supplied; reports must show missing-factor state until a
supported source/version is recorded.
