# Canonical compliance registry + trusted evidence binding — reconciliation contract

Status: **draft integration PR; not merge-ready, not release-approved**.

## Canonical registry
Use PR #35's `ComplianceRule` and immutable `ComplianceRuleVersion` as the only operational compliance registry. PR #21's `CorporateComplianceRule` and legacy `GET /api/compliance/rules?jurisdiction=...&entityType=...` must not remain a competing source of truth. Keep corporate graph entities and relationship models. Port graph-facing rule summaries through a scoped adapter over reviewed rule versions, returning UNKNOWN when evidence or applicability is insufficient.

Before any legacy table is dropped or migrated, conduct a reviewed data-presence assessment in each environment. This draft must not query or mutate production. If records exist, provide an idempotent mapping/export and reconciliation plan rather than silently dropping or reinterpreting them.

## Trusted evidence binding
The AI proposal request now accepts an `evidenceId` reference rather than caller-supplied IDs/statements/source URLs/evidence classes/retrieval timestamps as authoritative provenance. The proposal route performs a server-side read inside the authorized write transaction, checks verified review state, E3/E4 class, retrieval time, source metadata, and a clean/available/verified document within the active workspace and selected client, and persists a dedicated `BusinessIntentEvidenceReference` row with source/document references.

**Remaining checks:** validate the live Prisma schema against the migration and generated client; confirm each evidence record is bound to the correct client/workspace (including client-null cases); test revocation and read/attach races; ensure any verified evidence that influences recommendations is passed to the provider from server-resolved records rather than request free text; test nonexistent, foreign-workspace, foreign-client, revoked, incomplete, duplicate, and stale source records. E0/E1 user claims must remain unverified, and AI proposals must not autonomously promote graph nodes, compliance obligations, or other operational actions.

## Verified branch mismatch
- PR #21 contains graph models and the legacy compliance model, but not the versioned compliance registry or business-intent proposal model.
- PR #35 contains the versioned compliance registry but not PR #21's corporate graph models.
- PR #37 improves intake provenance validation but its original implementation stored caller statements and provenance in JSON.
- PR #38's graph read authorization patch targets PR #21 and must be replayed/retested after schema reconciliation.

## Migration / release sequence
1. Reconcile schema relations, enum types, foreign keys, and graph lifecycle fields as one coherent set.
2. Inspect and explicitly resolve the legacy `CorporateComplianceRule` table/migration. Do not remove it from a live environment without a reviewed conversion and rollback plan.
3. Ensure migrations have a single monotonic order and do not assume migrations can be applied safely out of timestamp order.
4. Run `prisma validate`, `prisma generate`, migrations on a clean disposable PostgreSQL database, and upgrades from representative fixtures.
5. Run lint, typecheck, all unit tests, DB integrity tests, production build and Playwright/E2E against one exact commit; record run IDs.
6. Apply PR #38's authorization checks to graph node/edge and audit reads/writes; verify workspace membership revocation and cross-tenant denial.
7. Obtain independent security review, migration/rollback sign-off, and explicit release approval. Keep release gate #32 open until every criterion passes.

## Current boundary
This branch is a draft checkpoint. Text-level schema structure has been checked, but Prisma validation, database migration rehearsal, full test suites, independent review, merge, production database changes and deployment are not yet complete or authorized.
