# Session 27 — Production Readiness & Pilot Launch Gate

This is a launch gate, not a feature session. Status is **NOT READY for pilot** until every
"Blocker" below is closed with evidence. Statuses: ✅ evidenced in repo, 🟡 partial, ❌ missing.

## Security

| Control | Status | Evidence / gap |
| --- | --- | --- |
| Tenant isolation tested | 🟡 | `authorized-workspace-transaction.test.ts`, `workspace-access.test.ts`, `client-portal-access.test.ts` use mocks. **Blocker:** run `database-integrity.integration.test.ts` against real Postgres in CI and add cross-tenant read/write cases per route family. |
| Authorization tested | 🟡 | Per-route tests exist for engagement, control plane, cross-border, memberships. **Blocker:** portal routes lack route-level tests (grant revoked/expired/wrong client). |
| Secrets controlled | ✅ | Auth secret now fails fast in production (`resolveAuthSecret`). Worker secret via `lib/auth/worker-secret.ts`. Remaining: store secrets in a manager, rotation runbook. |
| Production headers | ✅ | `next.config.ts` sets nosniff, frame deny, referrer, permissions, HSTS, minimal CSP. **Follow-up:** full nonce-based CSP (see `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`); verify on the deployed host. |
| Rate limiting | ❌ **Blocker** | No limiter anywhere. Needs shared-store limiting (edge/WAF or Redis) on sign-in, uploads, portal APIs, worker endpoints. In-memory limiting is not valid on multiple instances. |
| Audit integrity | 🟡 | Audit tables exist for portal, documents, actions. No tamper evidence. Decide: DB-level append-only (revoke UPDATE/DELETE) or hash chaining, before pilot. |

## Reliability

| Control | Status | Evidence / gap |
| --- | --- | --- |
| Backup strategy | ❌ **Blocker** | Not documented. Required: managed Postgres PITR, daily snapshot, object-storage versioning for evidence, stated RPO/RTO. |
| Recovery procedure | ❌ **Blocker** | Needs a written runbook and one rehearsed restore into a scratch environment, with migration replay (`prisma migrate deploy`) verified. |
| Worker failure handling | 🟡 | Worker routes and tests exist (`notification-worker`, `operational-escalation-worker`). Verify lease/timeout behaviour on crash. |
| Notification retries | ✅ | Retry/redrive in `notification-worker.ts`, `notification-redrive-route.test.ts`. Confirm dead-letter alerting. |
| Observability | ❌ **Blocker** | Only `console.error`. Needs structured logs, error tracking, health endpoint, alerts on worker failure and queue age. |

## Product (must be proven with real data, not tests)

- [ ] Real onboarding of one professional workspace.
- [ ] Real client, with portal grant and published tasks.
- [ ] Real formation workflow end to end.
- [ ] Real compliance workflow with authoritative obligations.
- [ ] Real evidence: upload, scan, review.
- [ ] Real report generated.
- [ ] Real professional review recorded.

Known product gap: client completion actions, comments, messaging, signatures and approvals
(Session 26 sequel) are not built. Decide whether they are pilot-required.

## Commercial

| Item | Status |
| --- | --- |
| Plan / entitlements / usage / credits | 🟡 domain + migration + `billing.test.ts` exist (Session 25) |
| Payment provider (e.g. Paystack/Stripe) | ❌ **Blocker** (none integrated; consider African-market providers) |
| Invoice | ❌ |
| Cancellation, upgrade/downgrade | ❌ |
| Usage accounting reconciled against invoices | ❌ |

A pilot may run with manual invoicing if entitlements are enforced server-side. State that decision explicitly.

## Pilot plan

- Scope: 2–3 professional users, 3–5 real companies, one primary jurisdiction (suggest Nigeria or Ghana).
- Pre-conditions: all Blockers closed, migrations replayed on Postgres, restore rehearsed.
- Run: weekly review of workflow breakages, support log, audit sampling, evidence-scan failures.
- Exit criteria: no cross-tenant incident, no lost evidence, restore proven, each professional completes a real workflow, commercial flow decided.
- Rollback: disable portal grants and worker schedules; restore from PITR.

## Changes made in this session

- `next.config.ts`: production security headers.
- `lib/auth/auth-options.ts`: refuse to start in production without `NEXTAUTH_SECRET`.
