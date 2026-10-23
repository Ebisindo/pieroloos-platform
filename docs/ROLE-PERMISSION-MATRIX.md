# PieroloOS Role and Permission Matrix

**Status:** implementation-aligned reference; not a substitute for route-by-route security review.

This matrix reflects the current code in `lib/auth/roles.ts`, `lib/auth/workspace-access.ts`, `lib/auth/workspace-context.ts`, and `lib/auth/client-portal-access.ts`. Update it with the permission implementation and tests in the same pull request whenever authorization semantics change.

## Workspace roles

The application currently persists organization membership roles `OWNER`, `ADMIN`, `ADVISOR`, `MEMBER`, and `VIEWER`. These map to lower-case application roles when the active workspace principal is constructed. There are no separate persisted `INVESTOR` or `EXTERNAL_PARTNER` workspace roles today; those use the read-only role or explicit client-portal grants until a reviewed model says otherwise.

| Capability / permission | Owner | Admin | Advisor | Member | Viewer |
| --- | --- | --- | --- | --- | --- |
| `workspace:read` | Yes | Yes | Yes | Yes | Yes |
| `workspace:manage` | Yes | Yes | No | No | No |
| `settings:manage` | Yes | No | No | No | No |
| `client:read` | Yes | Yes | Yes | Yes | Yes |
| `client:write` | Yes | Yes | Yes | Yes | No |
| `client:delete` | Yes | Yes | No | No | No |
| `engagement:read` | Yes | Yes | Yes | Yes | Yes |
| `engagement:write` | Yes | Yes | Yes | Yes | No |
| `engagement:delete` | Yes | Yes | No | No | No |
| `evidence:read` | Yes | Yes | Yes | Yes | Yes |
| `evidence:write` | Yes | Yes | Yes | Yes | No |
| `evidence:review` | Yes | Yes | Yes | No | No |
| `evidence:delete` | Yes | Yes | No | No | No |
| `report:read` | Yes | Yes | Yes | Yes | Yes |
| `report:write` | Yes | Yes | Yes | No | No |
| `compliance:read` | Yes | Yes | Yes | Yes | Yes |
| `compliance:write` | Yes | Yes | Yes | Yes | No |
| `audit:read` | Yes | Yes | No | No | No |

The table describes the centralized role map. Resource ownership, client-portal capability grants, tenant scoping, request-origin checks, authentication, and route-specific preconditions can impose additional restrictions; a role's “Yes” is not blanket access to every row in the database.

### Platform administration is separate

`PlatformAdministrator`, `PlatformAdministratorPermission`, and `PlatformSuperAdmin` are platform-level models, distinct from workspace membership. Super Admin provisioning must stay controlled and audited. Do not grant platform privileges through workspace roles, client-supplied fields, email matching, or self-service endpoints.

## External client and professional access

External people must not be represented as general workspace members solely to give them a narrow client view.

The current client portal uses `ClientPortalGrant`, scoped to organization, workspace, client and user. The grant carries explicit capabilities:
- `canViewStatus`
- `canViewTasks`
- `canUploadEvidence`

The grant can be expired or revoked. Server-side grant transactions re-check the exact grant, resource scope, revocation, expiry and requested capability. Each portal route must still ensure that the selected record belongs to the granted client and active workspace.

The portal grant currently does **not** include a generic permission to review evidence, approve legal/compliance conclusions, administer partner users, see arbitrary reports or access other clients. Any new capability needs a dedicated schema/API/UI test and an audit decision. Investor-facing views should remain read-only and scoped; the current `VIEWER` role is read-only at workspace level but may be too broad for a future investor product. Prefer explicit grants for that case.

## Mandatory enforcement rules

1. Obtain the authenticated user and active workspace server-side. Never trust client-supplied organization/workspace IDs as authority.
2. For writes, validate request origin, validate input, check the requested permission, and use `withAuthorizedWorkspaceTransaction` so current membership and workspace are revalidated in a serializable transaction.
3. Include both workspace and organization context in resource queries where those fields exist. Do not use globally unique IDs as a substitute for tenant scoping.
4. For portal resources, use the grant-scoped transaction and re-check the client/workspace relationship in the actual data query.
5. Return non-disclosing `404` responses when a resource is outside the authorized tenant scope; do not reveal whether another tenant owns the ID.
6. Audit material grant, role, privileged, graph and compliance-review changes. Do not log secrets or unnecessary client-sensitive content.
7. Treat UI-hidden actions as usability only; every API must enforce authorization itself.
8. Treat access revocation, expiry and workspace changes as live state and revalidate before committing mutations.
9. Keep Super Admin provisioning separate, minimally available, and audit logged. A normal organization owner is not automatically a platform administrator.
10. Before launch, verify cross-tenant reads/writes and revoked/expired grants against PostgreSQL, not only mocked unit tests.

## Verification expectations

The centralized role map and authorization helpers have unit tests in `tests/workspace-access.test.ts`. Authorized workspace transactions are tested in `tests/authorized-workspace-transaction.test.ts`; client portal capability and grant behavior are covered in the portal-access/route suites. These tests are not a substitute for end-to-end testing every resource family.

Release evidence must include lint, typecheck, unit tests, database migration/integrity tests, production build and Playwright/E2E checks. Cross-tenant API reads/writes, expired/revoked grants, workspace switching, privilege escalation attempts and read-only restrictions must be explicitly covered. A green CI run is not a penetration test or approval for production deployment.

## Known follow-up work

- Create an explicit, least-privilege model for third-party professional partner accounts when partner onboarding is implemented.
- Define investor-specific read-only projections rather than sharing unrestricted workspace viewer access.
- Add shared rate limiting before multi-instance launch; the existing default limiter is in-process.
- Establish append-only/tamper-evident audit retention, backup/restore and incident response procedures.
- Complete independent security review and route-by-route tenant-isolation testing before pilot launch.
