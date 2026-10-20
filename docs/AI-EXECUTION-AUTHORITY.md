# AI proposal approval and execution authority

## Security boundary

An AI/provider response, proposal status, evidence label, confidence score, or caller-supplied metadata is never execution authority. Proposal review and execution consent are distinct actions. This document describes the first execution-authorization ledger slice; it does **not** claim that filing, payment, privilege mutation, or corporate-graph execution is wired to this ledger.

## Current route inventory

| Entry point | Current responsibility | Must not be treated as |
| --- | --- | --- |
| `POST /api/ai/business-intent/proposals` | Creates a workspace-scoped, unapproved proposal snapshot after server-side entitlement and evidence checks | Approval or execution consent |
| `PATCH /api/ai/business-intent/proposals/:id/review` | Records an independent human decision against `expectedVersion`; conditional update rejects stale/racing reviews | Consent to execute any external action |
| `POST /api/ai/business-intent/proposals/:id/execution-authorizations` | Records a separate, explicit, short-lived authorization bound to a currently approved proposal version and exact typed operation digest | A command to execute, a provider call, or proof that anything external happened |
| `POST /api/ai/business-intent/proposals/:id/execution-authorizations/:authorizationId/revoke` | Atomically revokes an active authorization or records its expiry, with an activity event | A substitute for executor-side expiry/revocation checks |
| `/api/corporate-graph/*` | Existing workspace-authorized graph lifecycle endpoints with their own validation/audit behavior | AI-authorized graph execution; no binding to this ledger is implemented in this slice |
| Filing/payment/privilege integrations | Must be inventoried and reviewed before any execution adapter is built | Authorized by a proposal or by this ledger without a dedicated adapter |

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
- An explicit revocation endpoint now transitions active authorization to `REVOKED` and records an activity event; attempting to revoke an expired authorization records `EXPIRED` before returning a conflict. This is not a scheduled expiry sweeper: every executor must check `expiresAt` directly and fail closed even if the persisted status still says `AUTHORIZED`.
- Verify evidence IDs, source versions/checksums, freshness, revocation and tenant/client scope in the executor immediately before side effects. Never trust a proposal's JSON or model output as verified evidence.
- Filing/payment adapters need account/environment allowlists, legal-entity/jurisdiction/recipient/amount confirmation, provider idempotency where supported, reconciliation and fail-closed behavior. Do not enable production actions based on a sandbox test.
- Add integration tests with PostgreSQL for unique-key races, two different keys targeting the same operation, expiry/revocation races, proposal version changes, tenant/client mismatches, transaction rollback, audit-write failure and zero-side-effect denial. Mocked route tests alone are not sufficient.
- Audit any existing graph, billing/payment, filing, privilege and notification route for bypasses before linking it to AI proposals. Approval or authorization must not be inferred from generic status fields.
- Obtain independent security, database and product review; run the complete CI/security workflows on the exact final head. No production migration, deployment, filing, payment or privilege change is authorized by this PR.

## API request contract

The endpoint requires `expectedVersion`, `idempotencyKey`, `confirmExactOperation: true`, an allow-listed `operationType`, and the typed `operation` snapshot. Recipient, amount, filing content digest, graph targets or privilege target are part of the digest when relevant. Filing/payment requests currently accept only `SANDBOX`; production consent is deliberately fail-closed. The server issues a 15-minute authorization only after the approved proposal/version is re-read in the authorized transaction.

The explicit confirmation field is a server-enforced API contract; a production UI must render the material parameters back to the user and require a deliberate confirmation gesture. Do not wire this endpoint to a background agent or call it automatically after proposal approval.
