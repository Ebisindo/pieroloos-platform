# Session 20 — Identity, Tenant Isolation & Authorization Hardening

Session 20 makes workspace identity and authorization explicit across application routes, services, and repositories. This work remains in progress until the verification gaps below are closed; it is not a production-security certification.

## Implemented controls

- A workspace principal carries the user, organization, workspace, persisted role, and derived permissions. Persisted roles are validated rather than cast into application roles.
- Sensitive writes use `withAuthorizedWorkspaceTransaction`, which rechecks the actor's current organization membership, role, and workspace relationship in a serializable PostgreSQL transaction before performing the operation.
- Client, engagement, compliance, evidence, formation, and activity reads now require a principal and scope resource IDs to that principal's active workspace. Writes validate referenced resources in the authorized transaction, derive tenant IDs from the principal, and write activity audit records in the same transaction.
- Membership role listing and changes are owner-only. The last organization owner cannot be removed or demoted through this API, and membership changes are audited.
- Workspace switching validates the requested workspace against the signed-in user's organization membership.
- Browser mutations reject missing, malformed, or cross-origin `Origin`/`Referer` provenance. Bearer-authenticated worker routes remain separate.
- Sessions have an eight-hour maximum age; production startup requires `NEXTAUTH_SECRET`. Workspace membership and role are read live when a principal is assembled.
- Previously unimplemented document, reminder, escalation, and report endpoints return explicit `501` responses rather than success-shaped mock results.
- Operational action assignment and compliance obligation assignment recheck that the assignee remains an organization member inside the write transaction.
- Control-plane action identifiers are scoped in the initial lookup and conditional update, reducing cross-tenant existence oracles.

## Verification

- Unit tests cover principal permission derivation, stale membership/role rejection, workspace membership role changes, cross-tenant resource IDs, engagement authorization, request-origin checks, and assignment behavior.
- The PostgreSQL integration suite includes a cross-workspace client read/mutation test using the real scoped repository and transaction helper. It runs only when `DATABASE_INTEGRATION_TESTS=1` and points at a disposable test database.
- The normal test runner does not execute PostgreSQL integration tests. A passing unit suite alone does not satisfy the Session 20 exit gate.

## Outstanding exit-gate work

- Run and retain evidence from the PostgreSQL tenant-boundary suite against an isolated PostgreSQL database; do not point it at staging or production.
- Evaluate and, where compatible with existing data, add database-level composite tenant constraints for relations that currently rely on application checks. This requires a migration and data-integrity review.
- Complete a route-by-route inventory of all sensitive reads and writes, including worker/service entry points, and add cross-tenant negative tests for each externally reachable resource family.
- Decide and verify session revocation semantics beyond live membership/role validation and the eight-hour expiry.
- Exercise concurrent permission revocation and tenant mutations against PostgreSQL; document any residual race or operational limitation.

Do not claim universal tenant isolation or advance to the next trust session until these gates are evidenced.
