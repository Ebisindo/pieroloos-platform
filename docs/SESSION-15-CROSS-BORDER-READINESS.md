# Session 15 — Cross-border preparation and readiness evidence

Session 15 adds an auditable preparation checklist to each Session 14 market-entry pathway. Assessments are immutable snapshots assembled from records already held in the selected workspace.

## Delivered

- Added persisted readiness assessment snapshots with assessor, pathway version, result, and assessment time.
- Assesses core business-profile completeness, linked formation-task progress, recorded target-market obligations, linked evidence coverage, and professional-review state.
- Records explicit `NOT_CONFIGURED`, `NEEDS_INPUT`, and `NOT_ASSESSED` states instead of treating missing information as success or as a zero score.
- Appends an audit event in the same database transaction as each assessment snapshot.
- Requires a current assessment before professional review; an incomplete preparation snapshot cannot be approved.
- Ties review to the assessment version and requires that reviewed assessment before starting the pathway.
- Shows checks, next steps, assessment freshness, and boundaries in the Market Expansion workspace.

## Readiness interpretation

The result is a preparation checklist, not a certification. The workflow does not assess:

- market fit, legal entity suitability, tax consequences, licenses, sanctions, or export controls
- bank account availability, payment rails, foreign exchange, or counterparty risk
- data-transfer rules or local employment requirements
- accuracy, sufficiency, or currentness of professional and government sources

These controls must be assessed by qualified professionals using authoritative, current sources before a business acts or transacts. An internal review record is not government approval or legal advice.

## API

- `POST /api/market-entry/[id]/readiness` — derive and save a new workspace-scoped assessment.
- `POST /api/market-entry/[id]/review` — record a permission-checked review of the current pathway assessment.

Each assessment stores its source pathway version so subsequent pathway changes are detectable. Assessments are snapshots; when the source business, formation, or obligation data changes, users should reassess before relying on an earlier snapshot.

## Validation

Session 15 is covered by the Session 19 PostgreSQL migration, drift, integrity, TypeScript, Vitest, ESLint, and production-build checks. Apply migrations only through the explicit target procedure documented in [Session 19 — Production Data Integrity & Migration Control](./SESSION-19-PRODUCTION-DATA-INTEGRITY.md); the target environment must pass verification before deployment.
