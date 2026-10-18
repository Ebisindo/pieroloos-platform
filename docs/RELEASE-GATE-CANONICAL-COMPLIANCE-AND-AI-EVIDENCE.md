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


## Evidence-boundary limitations requiring resolution before merge
- `Evidence` is currently a legacy global model with no `workspaceId`; trusted use relies on a separately linked document satisfying tenant/client filters. Review whether one evidence record can be linked to documents in multiple workspaces and enforce the required tenant isolation with a schema constraint or a workspace-scoped evidence source model.
- Establish a definitive null-client policy. When no client is selected, the application must still prove workspace ownership and may not rely on an arbitrary first matching document.
- Verify source/document immutability, revocation races, and a durable tenant-aware evidence binding constraint. Evidence review status must be rechecked transactionally at binding, and document/evidence relationships must not cross workspace or client boundaries.
- CI must verify the new Prisma relations/migration and negative tests on this exact branch head. Structural text inspection is not Prisma validation.

## OpenAI API and runtime readiness

The business-intent provider is server-only and reads these runtime variables:
- `PIEROLOOS_AI_PROVIDER=openai`
- `OPENAI_API_KEY` — a project-scoped API key supplied through the deployment platform's secret manager.
- `PIEROLOOS_AI_MODEL` — an explicitly configured model identifier that is available to the selected OpenAI API project and compatible with the code's Chat Completions JSON-response contract.

### Secret handling
- Never commit an API key to source control, `.env.example`, documentation, browser bundles, PR comments, logs, or issue attachments.
- Do not use a `NEXT_PUBLIC_*` variable for API credentials.
- Use separate least-privilege credentials for development, CI smoke tests, and production. Unit tests should mock the provider; only approved, bounded integration tests should call the external API.
- Store and rotate credentials through the chosen platform's secret-management interface. If a key is exposed, revoke it and replace it; do not merely remove it from the latest commit.
- Confirm usage limits, billing, access scope, timeout behavior, sanitized failures, and monitoring before enabling live generation.

### Runtime boundary
This application calls OpenAI from a server-only service. The API key must remain in a trusted server runtime. A static Firebase Hosting site alone must not be treated as proof that Next.js API routes or server-side code are running. Before enabling AI calls, deploy those routes to an approved server-capable runtime (for example, Firebase App Hosting/Cloud Run with managed secrets) or use a separately deployed authenticated backend; then verify server-side route authorization and secret availability without returning the key to the browser.

Official references:
- OpenAI Platform: https://platform.openai.com/docs/api-reference
- Firebase App Hosting framework support and runtime: https://firebase.google.com/docs/app-hosting/frameworks-tooling

### Readiness acceptance
- [ ] Finish the secure OpenAI API-key setup flow and copy the key directly into the intended secret manager; do not paste it into chat or GitHub.
- [ ] Configure the three runtime variables in the correct server environment.
- [ ] Confirm the configured model is available and supports the code's API/JSON contract.
- [ ] Confirm production server routes execute in a server-capable runtime and that the browser never receives the key.
- [ ] Validate a bounded smoke test against a non-production project and review usage/billing.
- [ ] Keep CI using mocked credentials and no production secret by default.
- [ ] Document rollback, key rotation, runtime ownership, and monitoring before enabling production use.
