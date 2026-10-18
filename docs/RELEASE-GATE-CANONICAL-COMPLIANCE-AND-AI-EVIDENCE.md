# Integration plan: canonical compliance registry and trusted AI evidence

Status: implementation gate; do not merge or deploy production.

## Decision 1 — one canonical compliance registry
PR #35's `ComplianceRule` and immutable `ComplianceRuleVersion` are the canonical rule registry. PR #21's `CorporateComplianceRule` model and the legacy `GET /api/compliance/rules?jurisdiction=...&entityType=...` endpoint must not be merged as a second registry. Keep corporate graph models and graph routes, and move any required assessment presentation to an adapter/read service over the current reviewed `ComplianceRuleVersion` records. Preserve UNKNOWN/insufficient-evidence behavior and never represent an empty result as compliance.

Before removing the old model from a combined schema, identify whether any data has been persisted in any environment. If it has, provide a reviewed export/backfill/mapping plan into canonical rule versions; do not silently drop data. Production is not to be queried or migrated as part of this code change.

## Decision 2 — trusted evidence binding for AI proposals
The current AI intake accepts client-authored fact IDs, statements, source URLs and E0/E1 labels, then persists a JSON snapshot. That makes these values claims, not trusted evidence. New proposal intake must not accept user-selected IDs as proof of source authority.

Recommended contract:
- Separate free-text claims from evidence references.
- A submitted evidence reference must resolve server-side within the active organization, workspace, and selected client (where applicable).
- Reject unknown, inactive, revoked, unreviewed, cross-workspace/client, and mismatched-source references.
- Read provenance/class/retrieval time from the persisted record, never from request payloads.
- Preserve source IDs and stable provenance snapshots in the proposal for audit; distinguish unverified user claims (E0/E1) from verified evidence.
- Fail closed when the canonical evidence domain does not provide a suitable workspace/client-scoped source record. Do not treat the legacy global `Evidence` model as workspace-owned until its schema and write paths establish tenant scope and review semantics.
- The proposal remains non-operational until an independent, authorized human review transition succeeds.

## Integration order
1. Reconcile PR #21 and PR #35 in one code branch; one rule schema and endpoint only.
2. Reconcile PR #37 with the evidence data model and production graph validator.
3. Integrate PR #38's transactional authorization revalidation.
4. Add route and DB regression tests for registry uniqueness, tenant boundaries, stale/revoked evidence and approved-only promotion.
5. Run Prisma validation, migration-integrity tests, lint, typecheck, unit tests, production build, and Playwright/E2E on the integrated head.
6. Obtain independent security review, qualified jurisdiction/legal review where applicable, manual accessibility review, and documented backup/restore plus deployment approval before production operations.

## Safety boundary
This plan does not authorize a production database mutation, schema deployment, merge, or release. Branch migrations may be added only after a dry-run-compatible migration sequence and data-retention decision have been reviewed.
