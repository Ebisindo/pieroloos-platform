# PieroloOS API Authorization Audit Matrix — Baseline Inventory

**Original inventory baseline:** `7dfb4fe61f5af3a58f84bf37b791d0d240c243f7` (main, inspected 2026-10-19).  
**Current integration stack:** schema candidate PR #72 at `e45dbd8863bb5571cc8781d9f93f4eb82a329932`; security/dependency candidate PR #73 at `0e2f2b0d2d01b211838b759beeaa6304fea5f6ac`. Both are drafts and have not been merged.  
**Inventory:** 78 API route files in the original baseline; re-inventory current route handlers before release. Method-level review remains in progress. This is a work register, not a security approval.

## Required record for every handler
For each exported GET/POST/PATCH/PUT/DELETE/HEAD/OPTIONS method, record: authentication/session source; required permission or platform role; organization/workspace/client/resource predicate; revalidation inside the protected transaction; Origin/CSRF and body/schema/rate limits; download/export scan/review and URL protections; worker-secret/replay controls; audit and log behavior; regression tests; latest-head CI; independent reviewer/sign-off.

## Confirmed release-blocking findings
1. The original `app/api/compliance/evidence/route.ts` returned a hard-coded example without authentication or scope checks. This integration candidate replaces it with a controlled HTTP 501 not-configured response and adds a regression test; keep it disabled until an authenticated, workspace/client-scoped repository contract and tests exist.
2. `app/api/reports/[id]/evidence/route.ts` returns 501. Treat as unimplemented.
3. `app/api/ai/business-intent/proposals/[id]/review/route.ts` needs expected-version protection and conditional updates. PR #37/#40 implement this on feature branches; not on main until deliberately integrated.
4. The Corporate Graph API read/write and audit handlers are workspace-scoped and use transaction-time authorization checks. Passing automated tests cover selected boundaries only; this is not a complete authorization audit.
5. PR #21 and PR #35 previously carried incompatible `/api/compliance/rules` contracts against `CorporateComplianceRule` versus the governed `ComplianceRule`/`ComplianceRuleVersion` registry. The current integration stack preserves the canonical governed registry and does not copy the legacy route or duplicate source of truth. Continue to verify API compatibility and migration/backfill behavior on the exact release head.
6. PR #40 resolves proposal evidence IDs to clean, reviewed documents scoped to active workspace/client, but its branch is 12 commits ahead and 3 behind main. Legacy `Evidence` has no inherent workspace scope; document binding is a bounded safeguard, not proof that every legacy evidence row has tenant-safe identity. Review null-client policy, digest/version binding, revocation races and provider-context handling before closing evidence controls.

## Negative-test matrix
- Unauthenticated, insufficient permission, inactive/stale membership.
- Guessed/cross-org, cross-workspace, cross-client IDs for clients, obligations, dossiers, documents, reports, proposals and grants.
- Expired/revoked grant, capability mismatch, viewer write, privilege escalation, role confusion.
- Missing/foreign Origin, malformed JSON, oversized body, invalid schema.
- Concurrent update/revoke/expiry vs protected operation; stale version conflicts without history/audit side effects.
- Download/export before scan/review, archived/deleted records, expiring URL controls and cross-client document access.
- Missing/invalid worker secrets, bounded batches, replayed redrive, duplicate delivery and audit consistency.
- Error/log paths must not expose private content, tokens, evidence secrets or provider payloads.

## Route-file inventory
Each file below must be broken into method-level audit entries. No item is considered passed merely because its filename was inventoried.

### Platform administration and workers
- [ ] `app/api/admin/administrators/route.ts`
- [ ] `app/api/control-plane/actions/[id]/assign/route.ts`
- [ ] `app/api/control-plane/actions/[id]/resolve/route.ts`
- [ ] `app/api/control-plane/actions/[id]/transition/route.ts`
- [ ] `app/api/control-plane/actions/route.ts`
- [ ] `app/api/workers/escalations/route.ts`
- [ ] `app/api/workers/notifications/[id]/redrive/route.ts`
- [ ] `app/api/workers/notifications/route.ts`

### Business formation and cross-border
- [ ] `app/api/ai/business-intent/proposals/[id]/review/route.ts`
- [ ] `app/api/ai/business-intent/proposals/route.ts`
- [ ] `app/api/cross-border/dossiers/[id]/controls/[controlId]/evidence/route.ts`
- [ ] `app/api/cross-border/dossiers/[id]/controls/[controlId]/route.ts`
- [ ] `app/api/cross-border/dossiers/[id]/controls/route.ts`
- [ ] `app/api/cross-border/dossiers/[id]/review/route.ts`
- [ ] `app/api/cross-border/dossiers/route.ts`
- [ ] `app/api/engagements/[id]/activities/route.ts`
- [ ] `app/api/engagements/[id]/route.ts`
- [ ] `app/api/engagements/[id]/transition/route.ts`
- [ ] `app/api/engagements/route.ts`
- [ ] `app/api/formation/decisions/route.ts`
- [ ] `app/api/formation/plans/[id]/route.ts`
- [ ] `app/api/formation/plans/[id]/tasks/[taskId]/route.ts`
- [ ] `app/api/formation/plans/route.ts`
- [ ] `app/api/jurisdictions/[id]/route.ts`
- [ ] `app/api/jurisdictions/compare/route.ts`
- [ ] `app/api/jurisdictions/route.ts`
- [ ] `app/api/market-entry/[id]/formation-plan/route.ts`
- [ ] `app/api/market-entry/[id]/readiness/route.ts`
- [ ] `app/api/market-entry/[id]/review/route.ts`
- [ ] `app/api/market-entry/[id]/route.ts`
- [ ] `app/api/market-entry/route.ts`

### Authentication and health
- [ ] `app/api/auth/[...nextauth]/route.ts`
- [ ] `app/api/health/route.ts`

### Client and portal
- [ ] `app/api/clients/[clientId]/portal-access/[grantId]/route.ts`
- [ ] `app/api/clients/[clientId]/portal-access/route.ts`
- [ ] `app/api/clients/[clientId]/portal-interactions/[interactionId]/route.ts`
- [ ] `app/api/clients/[clientId]/portal-interactions/route.ts`
- [ ] `app/api/clients/[clientId]/portal-visibility/route.ts`
- [ ] `app/api/clients/intake/route.ts`
- [ ] `app/api/portal/clients/[clientId]/documents/[documentId]/download/route.ts`
- [ ] `app/api/portal/clients/[clientId]/documents/route.ts`
- [ ] `app/api/portal/clients/[clientId]/interactions/route.ts`
- [ ] `app/api/portal/clients/[clientId]/route.ts`

### Workspace, settings and other
- [ ] `app/api/command-center/evidence/route.ts`
- [ ] `app/api/notifications/preferences/route.ts`
- [ ] `app/api/partnerships/inquiries/route.ts`
- [ ] `app/api/settings/route.ts`
- [ ] `app/api/workspaces/active/route.ts`
- [ ] `app/api/workspaces/memberships/route.ts`

### Graph and compliance
- [ ] `app/api/compliance/control-center/route.ts`
- [ ] `app/api/compliance/dashboard/route.ts`
- [ ] `app/api/compliance/escalations/route.ts`
- [ ] `app/api/compliance/evidence/route.ts`
- [ ] `app/api/compliance/obligations/[id]/assignment/route.ts`
- [ ] `app/api/compliance/obligations/[id]/deadline/route.ts`
- [ ] `app/api/compliance/obligations/[id]/evidence/[evidenceId]/review/route.ts`
- [ ] `app/api/compliance/obligations/[id]/evidence/route.ts`
- [ ] `app/api/compliance/obligations/[id]/reminders/route.ts`
- [ ] `app/api/compliance/obligations/[id]/review/route.ts`
- [ ] `app/api/compliance/obligations/[id]/status/route.ts`
- [ ] `app/api/compliance/obligations/route.ts`
- [ ] `app/api/compliance/rules/[id]/versions/[versionId]/generate/route.ts`
- [ ] `app/api/compliance/rules/[id]/versions/[versionId]/review/route.ts`
- [ ] `app/api/compliance/rules/[id]/versions/route.ts`
- [ ] `app/api/compliance/rules/route.ts`
- [ ] `app/api/corporate-graph/audit/route.ts`
- [ ] `app/api/corporate-graph/edges/[id]/route.ts`
- [ ] `app/api/corporate-graph/edges/route.ts`
- [ ] `app/api/corporate-graph/nodes/[id]/route.ts`
- [ ] `app/api/corporate-graph/nodes/route.ts`
- [ ] `app/api/corporate-graph/route.ts`

### Documents and reports
- [ ] `app/api/documents/[id]/download/route.ts`
- [ ] `app/api/documents/[id]/review/route.ts`
- [ ] `app/api/documents/[id]/route.ts`
- [ ] `app/api/documents/[id]/versions/route.ts`
- [ ] `app/api/documents/route.ts`
- [ ] `app/api/reports/[id]/evidence/route.ts`
- [ ] `app/api/workers/documents/scan-results/route.ts`

## Verified CI state (2026-10-19)
- PR #35 reconciled with main: head `91298801883258e51802bc3251bf9c4183e7aefa`; compare 82 ahead / 0 behind; CI [#39169156154](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39169156154) quality and E2E passed.
- PR #38 graph authorization fix: CI [#39176525376](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39176525376) quality and E2E passed at head `7ad96f1ebb6670163246acdb9e9e9459bf78df26`.
- PR #40 evidence binding: CI [#39173090235](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39173090235) passed at checked head `a17dfecf6c970d73415222e94caab1b2945f8a20`; branch compare is 12 ahead / 3 behind and requires reconcile/retest.
- PR #39 integration remains draft; the recorded work did not establish full Prisma validation, migration execution, database integrity, build or E2E success.
- Independent review submissions remain empty for #21, #35, #37, #38 and #40. Placeholder accounts tried were not eligible collaborators. A named independent reviewer with repository access must be added/requested by the owner.

## Release control
This matrix is an evolving review register, not evidence of completed manual security review. No merge, production migration or deployment is authorized here. Keep Issues #24/#25 and release gate #32 open until registry/evidence integration is tested, route-method entries are audited, CI is green on reconciled heads, independent security/database review is recorded, and backup/restore evidence plus migration approval are documented.
