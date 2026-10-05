# Source-backed project context

Source: [original brief](source/DOC-20260817-WA0001.pdf), with full text in
[page-labelled extraction](source/brief-extracted.md). Page references below refer
to physical PDF pages, not the table of contents, whose numbering drifts.

## Project identity

- Course: BCSE302P - Database Systems Laboratory.
- Title: Decentralized Surplus Food & Perishable Redistribution Platform.
- Track: T5/T6 - Waste & Circular Economy / Healthcare & Well-being.
- Ryan Fernandes, 24BCE0565: database design, backend/matching, documentation.
- Aritra Ghosh, 24BCE0598: frontend prototype, testing and stakeholder validation.
- Brief roadmap: controlled prototype targeting TRL 4 at internal review; real
  donor/receiver validation targeting TRL 5 at October 2026 Expo. The review date is
  unspecified. These are original targets, not proof of current readiness.

## Problem and stakeholders (pp. 3-5)

Restaurants, campus/hostel kitchens, caterers, bakeries and grocers produce edible,
time-critical surplus. NGOs, shelters, community kitchens and verified individuals
need discoverable supply. Volunteers provide last-mile transport. Ward/city
coordinators need auditable records. Informal calls and messages lack shared
discovery, allocation controls, and outcome records.

The intended scope is short-radius redistribution within a ward/pincode-cluster
zone. Multiple zones and cities are supported in the data model. Decentralization
means direct participation and local discovery; the prototype uses one database.

## Proposed workflow (pp. 5-7, 14)

Register and verify roles/zone -> donor lists food and pickup coordinates -> match
by zone, proximity, time remaining and receiver capacity -> one receiver claims
transactionally -> volunteer accepts -> pickup and delivery timestamps -> ratings,
per-user hash-linked trust events -> zone/city impact reporting.

## Database-centred requirements (pp. 7-13)

Eight original entities: ZONE, USERS, FOOD_LISTING, CLAIM, PICKUP, RATING,
NOTIFICATION, TRUST_LEDGER. PICKUP has composite key `(ClaimID, PickupID)`.
The course expects ER/EER, relational mapping, 1NF/2NF/3NF justification, constraints,
DML/query examples, locking transactions, triggers, routines, views, spatial and
partial indexes, and database/application access control.

The PDF SQL is illustrative: only four tables have sample DDL; application checks,
indexes, RLS policies and several fields are described without implementation.
Do not copy those fragments as a complete production schema. The recorded
[design decisions](decisions/0001-prototype-design.md) resolve the gaps.

## Validation and impact (pp. 14-16)

The source asks for constraint and simultaneous-claim tests, expiry testing, FR
coverage, week-long representative scenarios across 3-4 zones, interviews with at
least one campus mess/eatery and one NGO/shelter, and pilot comparison if feasible.
Metrics include kilograms, meals-equivalent, estimated CO2e, participation, and
average time-to-claim. The brief uses picked-up mass and a 0.4 kg meal assumption.
The plan preserves this metric and adds a separate delivered-food metric.

## Eight required deliverables (p. 16)

1. Problem Discovery Report.
2. Innovation Proposal.
3. Software Requirements Specification.
4. Database Design.
5. Application Prototype.
6. Testing & Validation.
7. Impact & TRL Report.
8. Expo Presentation.

Templates and evidence locations are listed in [deliverables](deliverables/README.md).

## Evidence not supplied

There is no application, operational database, external dataset, stakeholder
survey, pilot log, grading rubric beyond the brief, or slide deck in the supplied
material. The synthetic fixtures in this repository are newly prepared examples.

The brief cites UNEP Food Waste Index Report 2024 and India Global Hunger Index
2025 commentary and asserts food-waste, monetary and undernourishment figures.
This setup preserves the claims in the raw extraction but does not certify them.
Before using figures in the presentation, verify the original report/table/year,
population and waste sector. Do not label the 0.4 kg meal conversion as an official
standard without a supporting source. No CO2e factor is supplied.
