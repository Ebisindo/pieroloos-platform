# AI proposal approval and execution authority

## Security boundary

An AI/provider response, proposal status, evidence label, confidence score, or caller-supplied metadata is never execution authority. Proposal review and execution consent are distinct actions. This document describes the first execution-authorization ledger slice; it does **not** claim that filing, payment, privilege mutation, or corporate-graph execution is wired to this ledger.

## Current route inventory

The entries below are a source-level inventory of relevant paths inspected so far, not a claim that the repository-wide audit is complete. Interactive routes have their own authenticated human permissions; they are not wired to the AI authorization ledger and must not be repurposed as AI executor endpoints.

| Entry point | Mutation / responsibility | Current disposition |
| --- | --- | --- |
| `POST /api/ai/business-intent/proposals` | Creates a workspace-scoped, unapproved proposal snapshot after server-side entitlement and evidence checks | Proposal intake only; no authority to execute |
| `PATCH /api/ai/business-intent/proposals/:id/review` | Records an independent human decision against `expectedVersion`; stale/racing reviews are rejected | Review only; not execution consent |
| `POST /api/ai/business-intent/proposals/:id/execution-authorizations` | Records short-lived consent bound to an approved proposal version and typed operation digest | Ledger only; response explicitly says `executionPerformed: false` |
| `POST /api/ai/business-intent/proposals/:id/execution-authorizations/:authorizationId/revoke` | Revokes an active authorization or records expiry, with an activity event | Revocation only; future executors must independently enforce expiry/revocation |
| `POST /api/corporate-graph/nodes` | Creates a graph node; checks active workspace, `engagement:write`, client scope and writes an audit event in the authorized transaction | Direct interactive user mutation; not bound to AI authorization ledger |
| `PATCH /api/corporate-graph/nodes/:id` | Updates an active node scoped to organization/workspace and writes an audit event | Direct interactive user mutation; not bound to AI authorization ledger |
| `DELETE /api/corporate-graph/nodes/:id` | Archives a node and its active connected edges, with audit events | Direct interactive user mutation; not bound to AI authorization ledger |
| `POST /api/corporate-graph/edges` | Creates a relationship after endpoint validation, workspace node checks, ownership-total and cycle checks; writes audit event | Direct interactive user mutation; not bound to AI authorization ledger |
| `DELETE /api/corporate-graph/edges/:id` | Archives an active relationship scoped to organization/workspace and writes audit | Direct interactive user mutation; not bound to AI authorization ledger |
| `GET /api/corporate-graph/audit` | Reads recent workspace-scoped graph audit events | Read-only; not an executor |
| `PATCH /api/workspaces/memberships` | Changes an organization membership role with owner permission and a transactional activity event | Privilege-changing interactive route; not bound to AI authorization ledger |
| `DELETE /api/workspaces/memberships` | Removes a membership with owner permission and a transactional activity event | Privilege-changing interactive route; not bound to AI authorization ledger |
| `POST /api/clients/:clientId/portal-access` | Grants client portal access after client-write permission, client/email/account checks and service-level scope validation | Privilege/access mutation; not bound to AI authorization ledger |
| `DELETE /api/clients/:clientId/portal-access/:grantId` | Revokes a client portal grant via the portal service | Privilege/access mutation; not bound to AI authorization ledger |
| `GET /api/clients/:clientId/portal-access` | Lists grants under client-read permission and service-level scope checks | Read-only; not an executor |
| `POST /api/control-plane/actions` | Creates an operational workflow action from a trusted evidence-gap signal | Workflow-state mutation; not evidence of external filing/payment execution |
| Filing/payment provider execution | Product documentation says no payment provider is integrated; no dedicated filing executor was verified in the inspected code/search | No executor found in the inspected code/search; do not infer repository-wide absence |
| Other privilege, billing, notification, compliance, formation, cross-border, market-entry, worker and server-action paths | These families can mutate access, workflow state, records or communicate outcomes | Full path-by-path classification and bypass review remains open |

### Audit scope and disposition

- The graph routes above are authenticated, workspace-scoped interactive mutations with validation and audit events, but they do not consume an AI execution authorization. This is a separation to preserve, not evidence that AI-triggered execution is safe.
- Membership and client portal grant routes can change privileges/access through human-authorized actions; they are not connected to the AI authorization ledger. Any future AI-driven privilege mutation needs a separate typed executor and current-role checks.
- The control-plane action route creates workflow state from a trusted signal; it must not be described as having executed the underlying remediation or external action.
- Repository product documentation states that billing/payment provider integration is not implemented. The authorization schema accepts sandbox-only payment/filing operation descriptions, which are not provider integrations or evidence of a completed filing/payment.
- **This is not yet the full mutation-path audit.** The remaining review must enumerate every `app/api/**/route.ts`, server action, service, worker, scheduled task and provider client; inspect actual write/call sites (not just route names); classify database writes, privilege/access grants, billing/payment, filing/submission, notification/success signals, and workflow transitions; and record evidence plus tests for each path. The GitHub code search used for this pass is not sufficient to prove the absence of an executor or bypass.
- Issue #60 must remain open until that inventory is complete, all bypasses are dispositioned, PostgreSQL race/no-side-effect integration tests pass, and independent security/database/product review signs off.

## Authorization state machine

```text
PROPOSED
   | independent reviewer, exact expectedVersion, rationale
   v
APPROVED
   | separate explicit confirmation + typed operation + idempotency key
   v
AUTHORIZED (expires after 15 minutes)
   | future executor must re-check current identity/role/scope/version,
   | operation digest, expiry/revocation, and consume atomically
   v
CONSUMED

AUTHORIZED -> REVOKED
AUTHORIZED -> EXPIRED
```

A `CHANGES_REQUESTED` or `REJECTED` proposal cannot receive execution authorization. A proposal creator cannot review their own proposal, and authorization is refused if the recorded review is not independent. A stale proposal version is rejected. The server derives actor, organization and workspace from the authenticated principal; those fields are never accepted from the request.

## Operation snapshot and idempotency

The request schema is strict and accepts only four operation families: corporate-graph mutation, filing submission, payment, and privilege change. Each family has bounded, typed material parameters. The server canonicalizes the validated operation and computes SHA-256; it does not trust a caller-supplied digest. The authorization row stores the exact validated operation snapshot, proposal version, digest, actor, issue time, expiry, status and idempotency key. The key is unique per workspace. Reusing it for a different proposal/version/type/digest is rejected; an identical active retry returns the original authorization rather than creating a second row.

The database enforces workspace/proposal/user foreign keys, positive proposal version, SHA-256 digest format, expiry ordering, and workspace-scoped idempotency uniqueness. The authorization and its activity event are written in one authorized serializable transaction.

## Explicit limitations and required next steps

- **No executor is implemented here.** The endpoint always returns `executionPerformed: false`. It does not call a filing, payment, graph-mutation, notification or privilege-change provider. Filing and payment authorization requests are sandbox-only in this slice; production filing/payment consent is rejected until a separately reviewed step-up, account allowlist, recipient/legal-entity confirmation and reconciliation path exists.
- Do not close Issue #60 yet. Before consequential execution, add a dedicated typed executor/service for each operation family. It must atomically verify current authorization and proposal state, current actor permissions and tenant/client binding, expiry/revocation, exact operation digest and parameter snapshot, provider/environment allowlists, and an operation-level idempotency key; it must consume the authorization once and write the audit result in the same transaction where possible.
- Prevent two different authorization rows from executing the same operation twice. The current workspace idempotency key prevents retries with the same key, but is not by itself a cross-key duplicate-execution guarantee. The executor must enforce an operation-digest/target uniqueness or equivalent database-backed claim.
- An explicit revocation endpoint transitions active authorization to `REVOKED` and records an activity event; attempting to revoke an expired authorization records `EXPIRED` before returning a conflict. This is not a scheduled expiry sweeper: every executor must check `expiresAt` directly and fail closed even if the persisted status still says `AUTHORIZED`.
- Verify evidence IDs, source versions/checksums, freshness, revocation and tenant/client scope in the executor immediately before side effects. Never trust a proposal's JSON or model output as verified evidence.
- Filing/payment adapters need account/environment allowlists, legal-entity/jurisdiction/recipient/amount confirmation, provider idempotency where supported, reconciliation and fail-closed behavior. Do not enable production actions based on a sandbox test.
- Add integration tests with PostgreSQL for unique-key races, two different keys targeting the same operation, expiry/revocation races, proposal version changes, tenant/client mismatches, transaction rollback, audit-write failure and zero-side-effect denial. Mocked route tests alone are not sufficient.
- Obtain independent security, database and product review; run the complete CI/security workflows on the exact final head. No production migration, deployment, filing, payment or privilege change is authorized by this PR.

## API request contract

The endpoint requires `expectedVersion`, `idempotencyKey`, `confirmExactOperation: true`, an allow-listed `operationType`, and the typed `operation` snapshot. Recipient, amount, filing content digest, graph targets or privilege target are part of the digest when relevant. Filing/payment requests currently accept only `SANDBOX`; production consent is deliberately fail-closed. The server issues a 15-minute authorization only after the approved proposal/version is re-read in the authorized transaction.

The explicit confirmation field is a server-enforced API contract; a production UI must render the material parameters back to the user and require a deliberate confirmation gesture. Do not wire this endpoint to a background agent or call it automatically after proposal approval.
