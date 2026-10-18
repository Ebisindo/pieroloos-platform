# PieroloOS API Authorization Audit Matrix — Baseline Inventory

**Baseline commit:** `7dfb4fe61f5af3a58f84bf37b791d0d240c243f7` (`main`, inspected 2026-10-19)  
**Scope:** 78 API route files; method-level audit is not yet complete. This inventory is a work register, not a statement of compliance or security approval.

## Required record for every route and method

For every GET, POST, PATCH, PUT, DELETE, HEAD or OPTIONS handler, record:
- Authentication/session source and unauthenticated response.
- Required permission/role (workspace permission vs platform role).
- Organization, workspace, client and resource-level predicate.
- Whether the protected DB operation revalidates current scope in the transaction.
- Origin/CSRF validation, input/body bounds, schema validation and rate limits.
- For downloads/exports: ownership/scope, scan/review status, short-lived URL controls and safe content handling.
- For workers: secret configuration/failure behavior, replay bounds and audit trail.
- Success/failure audit semantics, sensitive-log handling, and denied-operation side effects.
- Regression test path and cases, latest-head CI run, independent reviewer/sign-off.

## Release-blocking findings confirmed on the baseline

1. `app/api/compliance/evidence/route.ts` returns a hard-coded example obligation view with no authentication/workspace/permission/resource lookup. Disable with a controlled not-configured response or implement the real scoped endpoint and tests.
2. `app/api/reports/[id]/evidence/route.ts` returns 501. Track as explicitly unimplemented; do not represent this as a functional evidence endpoint.
3. `app/api/ai/business-intent/proposals/[id]/review/route.ts` on baseline does not require `expectedVersion` and uses an unconditional update; PR #37 adds the version guard on its branch, so reconcile that change and ensure UI sends the version.
4. Corporate graph read revalidation is covered by PR #38 on its feature branch, with latest-head automated CI green. This remains a targeted fix and is not merged.
5. The same `/api/compliance/rules` route is implemented differently by PR #21 (`CorporateComplianceRule`) and PR #35 (`ComplianceRule` + version registry). Integration must establish one canonical governed registry; no route/schema copying that creates two sources of truth.

## Required negative-test matrix

- Unauthenticated; authenticated but insufficient permission; suspended/stale membership.
- Guessed identifiers across organizations, workspaces, clients, obligations, dossiers, documents, reports, proposals and grants.
- Expired/revoked grant, capability mismatch, viewer write attempt, privilege escalation, staff/client role confusion.
- Missing/foreign/incorrect Origin for mutations; invalid JSON, oversized body and invalid schema.
- Concurrent updates or concurrent revoke/expire vs protected operation; stale version must return conflict without history/audit side effects.
- Download/export before scan/review, deleted/archived records, short-lived URL behavior and cross-client document access.
- Missing/invalid worker secrets, bounded batch arguments, duplicate/replayed redrive and audit consistency.
- Error/log paths must not reveal private content, tokens, source secrets or provider payloads.

## Inventory by route file

### Platform admin & workers (8)
- [ ] `app/api/admin/administrators/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/control-plane/actions/[id]/assign/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/control-plane/actions/[id]/resolve/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/control-plane/actions/[id]/transition/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/control-plane/actions/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/workers/escalations/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/workers/notifications/[id]/redrive/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/workers/notifications/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.

### Business formation (23)
- [ ] `app/api/ai/business-intent/proposals/[id]/review/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/ai/business-intent/proposals/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/cross-border/dossiers/[id]/controls/[controlId]/evidence/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/cross-border/dossiers/[id]/controls/[controlId]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/cross-border/dossiers/[id]/controls/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/cross-border/dossiers/[id]/review/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/cross-border/dossiers/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/engagements/[id]/activities/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/engagements/[id]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/engagements/[id]/transition/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/engagements/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/formation/decisions/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/formation/plans/[id]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/formation/plans/[id]/tasks/[taskId]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/formation/plans/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/jurisdictions/[id]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/jurisdictions/compare/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/jurisdictions/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/market-entry/[id]/formation-plan/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/market-entry/[id]/readiness/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/market-entry/[id]/review/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/market-entry/[id]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/market-entry/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.

### Auth & health (2)
- [ ] `app/api/auth/[...nextauth]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/health/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.

### Client & portal (10)
- [ ] `app/api/clients/[clientId]/portal-access/[grantId]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/clients/[clientId]/portal-access/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/clients/[clientId]/portal-interactions/[interactionId]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/clients/[clientId]/portal-interactions/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/clients/[clientId]/portal-visibility/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/clients/intake/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/portal/clients/[clientId]/documents/[documentId]/download/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/portal/clients/[clientId]/documents/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/portal/clients/[clientId]/interactions/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/portal/clients/[clientId]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.

### Workspace, settings & other (6)
- [ ] `app/api/command-center/evidence/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/notifications/preferences/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/partnerships/inquiries/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/settings/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/workspaces/active/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/workspaces/memberships/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.

### Graph & compliance (22)
- [ ] `app/api/compliance/control-center/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/dashboard/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/escalations/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/evidence/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/obligations/[id]/assignment/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/obligations/[id]/deadline/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/obligations/[id]/evidence/[evidenceId]/review/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/obligations/[id]/evidence/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/obligations/[id]/reminders/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/obligations/[id]/review/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/obligations/[id]/status/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/obligations/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/rules/[id]/versions/[versionId]/generate/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/rules/[id]/versions/[versionId]/review/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/rules/[id]/versions/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/compliance/rules/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/corporate-graph/audit/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/corporate-graph/edges/[id]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/corporate-graph/edges/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/corporate-graph/nodes/[id]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/corporate-graph/nodes/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/corporate-graph/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.

### Documents & reports (7)
- [ ] `app/api/documents/[id]/download/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/documents/[id]/review/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/documents/[id]/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/documents/[id]/versions/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/documents/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/reports/[id]/evidence/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.
- [ ] `app/api/workers/documents/scan-results/route.ts` — enumerate methods; record policy, scope predicate, transaction revalidation, tests and reviewer.

## Verification status

- Automated CI on the PR #38 targeted graph authorization branch: latest-head run [#39171073665](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39171073665) passed, including quality and e2e. This does not make the application-wide audit complete.
- PR #40 evidence-binding branch: latest-head run [#39173090235](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39173090235) passed quality and e2e; branch still diverges from current `main`, so reconcile and rerun integrated CI.
- No independent review submissions are currently recorded for PRs #21, #35, #37, #38, #39 or #40. Reviewer requests to the available placeholder accounts were rejected by GitHub because they are not eligible collaborators.
- No merge, production migration or deployment is authorized by this matrix. Keep Issues #24/#25 and release gate #32 open pending code changes, integrated CI, named independent security/database reviews and verified backup/restore evidence.
