# Issue #60 — Mutation-path audit register

**Status: in progress; not a complete repository-wide audit.** This register is intentionally conservative: a code-search hit is a lead, not proof that every caller or side effect has been inspected. No production action is authorized by this audit.

## Scope and evidence method

Searches on the current `main` snapshot (base commit `59d800952540abcf45d8a3b8ae607451be05aca5`) covered transaction entry points, direct Prisma mutations, API calls from UI components, AI/business-intent routes, and the existing execution-authority register. The initial findings below identify priority paths and the evidence still required. A final audit must enumerate every `app/api/**/route.ts`, server action, service, worker, scheduled task, provider client, admin script, and direct database mutation; it must also follow imports/callers rather than relying on text search alone.

## Initial path register

| Path or family | Mutation / side-effect class | Current evidence | Remaining verification |
|---|---|---|---|
| `app/api/corporate-graph/edges/route.ts` | Creates graph edge and audit event | Uses `withAuthorizedWorkspaceTransaction`; transaction helper uses PostgreSQL Serializable isolation; P2034 maps to HTTP 409 | New real-PostgreSQL race and audit rollback tests in this PR; run against disposable PostgreSQL and review resulting logs |
| `app/api/corporate-graph/edges/[id]/route.ts` | Archives graph edge | Search shows authorized transaction and scoped edge lookup/update | Inspect full authorization, audit atomicity, replay/archival races, and response behavior |
| `app/api/corporate-graph/nodes/route.ts`, `app/api/corporate-graph/nodes/[id]/route.ts` | Creates/updates/archives graph nodes and connected edges | Execution-authority documentation lists these as direct interactive mutations, not bound to AI authorization ledger | Inspect all mutation branches, transaction isolation, ownership invariants, and rollback tests |
| `lib/auth/authorized-workspace-transaction.ts` | Shared workspace-authorized transaction boundary | Existing code uses Serializable isolation and rechecks membership/workspace state | Test authorization expiry/revocation, workspace switch, and membership races on PostgreSQL; inventory all callers |
| `lib/auth/client-portal-access.ts` | Client portal capability transaction | Search identifies a transaction with a grant lookup | Inspect capability checks, write paths, revocation race, and tenant isolation |
| `lib/services/notification-worker.ts` | Claims notification jobs and records attempts; external SMTP delivery | Search identifies claim/attempt transactions; execution-authority documentation notes delivery can be ambiguous after lease loss | Verify idempotency and retry/lease behavior; never claim exactly-once SMTP delivery without provider support and evidence |
| `app/api/workers/notifications/[id]/redrive/route.ts` | Redrives dead-letter notification | Search identifies a transaction and DEAD_LETTER state check | Inspect worker authentication, atomic compare-and-set, duplicate requests, and side-effect boundary |
| `lib/services/trusted-action-service.ts` | Creates operational workflow/action state | Search identifies transactional lookup/create | Confirm it creates workflow state only and cannot invoke the underlying external action |
| `scripts/provision-superadmin.mjs`, `scripts/transfer-superadmin.mjs` | Privileged administrator mutation | Search identifies transaction-backed privileged assignments | Require explicit operator controls, audit, concurrency protection, and separate authorization; no privilege change is authorized by Issue #60 work |
| `app/api/ai/business-intent/**` | Proposal review and execution-authorization ledger | Existing execution-authority docs distinguish review/authorization from execution and state the ledger is not yet an executor | Enumerate every route and consumer; verify one-time consumption, immutable digest/scope, expiry/revocation, replay resistance, and absence of provider bypass |
| `app/api/settings/route.ts`, `lib/db/client-repository.ts`, `lib/db/activity-repository.ts`, `lib/db/evidence-repository.ts` | Workspace-scoped application data mutations | Search identifies authorized transaction usage | Build route/service-level matrix; test unauthorized and cross-tenant requests leave no writes or external effects |
| UI-originated mutation requests including `/api/admin/administrators`, `/api/workspaces/active`, `/api/notifications/preferences`, `/api/formation/plans`, and `/api/partnerships/inquiries` | Calls into API mutation surfaces | UI search identifies request callers only | Resolve each endpoint to its server handler, auth model, rate limit, persistence and any downstream side effect |

## Required audit completion protocol

- [ ] Enumerate every route, server action, service, worker, scheduled task, provider client, admin script, and direct DB mutation from the exact reviewed commit.
- [ ] For each path, record actor/authentication, tenant and resource scope, permission, state/version precondition, transaction isolation, idempotency/replay behavior, audit event, external side effect, and failure/rollback behavior.
- [ ] Trace AI, scheduled, worker, and provider paths to ensure no alternate execution path bypasses the same authorization boundary.
- [ ] Add tests proving denied, stale, expired, revoked, replayed, cross-tenant, and concurrent requests produce no operational writes/provider calls/privilege changes.
- [ ] Run the integration suite against disposable PostgreSQL and attach logs tied to the exact PR head; mock-only tests are not a substitute for database concurrency evidence.
- [ ] Obtain independent named security, database, and product sign-off on the exact final SHA.

## Safety boundary

No production filing, payment, migration, deployment, or privilege change is authorized by this work. A proposal, review decision, authorization ledger row, queue item, or successful HTTP response is not proof that an external action was safely or actually executed. Keep Issue #60 open until every acceptance criterion has verified evidence and independent sign-off.
