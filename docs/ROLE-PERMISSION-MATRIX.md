# Workspace role and permission matrix

This document records the permissions currently implemented by `lib/auth/roles.ts` and the workspace-specific permission aliases in `lib/auth/workspace-access.ts`. It is a description of current code, not a claim that all governance requirements in Issue #25 are complete.

## Workspace role matrix

Legend: **R** = read; **W** = write/manage; **D** = delete; **Review** = review evidence. These are derived from the current `rolePermissions` map; server routes must still enforce resource and tenant scope.

| Capability | Owner | Admin | Advisor | Member | Viewer |
| --- | --- | --- | --- | --- | --- |
| Workspace read | R | R | R | R | R |
| Workspace management | W | W | — | — | — |
| Client read | R | R | R | R | R |
| Client write | W | W | W | W | — |
| Client delete | D | D | — | — | — |
| Engagement read | R | R | R | R | R |
| Engagement write | W | W | W | W | — |
| Engagement delete | D | D | — | — | — |
| Evidence read | R | R | R | R | R |
| Evidence write | W | W | W | W | — |
| Evidence review | Review | Review | Review | — | — |
| Evidence delete | D | D | — | — | — |
| Reports read | R | R | R | R | R |
| Reports write | W | W | W | W | — |
| Compliance read | R | R | R | R | R |
| Compliance write | W | W | W | W | — |
| Settings management | W | — | — | — | — |
| Audit read | R | R | — | — | — |

The current implementation gives the Owner every workspace permission. Admin receives all workspace permissions except `settings:manage`. Advisor, Member and Viewer use explicit allowlists in code. Treat these roles as organization/workspace staff roles: `member` is not the same as an external client or partner identity.

## Workspace aliases

The `WorkspacePermission` API uses a few product-specific aliases that map to canonical permissions:

| Workspace permission | Canonical permission |
| --- | --- |
| `jurisdictions:read` | `workspace:read` |
| `jurisdictions:write` | `workspace:manage` |
| `formation:read` | `workspace:read` |
| `formation:write` | `engagement:write` |
| `documents:read` | `evidence:read` |
| `documents:write` | `evidence:write` |
| `documents:review` | `evidence:review` |
| `documents:delete` | `evidence:delete` |
| `reports:read` | `report:read` |
| `reports:write` | `report:write` |

Permission aliases do not bypass resource-level checks. A handler must verify the active workspace and the resource's organization/workspace/client relationship. Sensitive mutations must revalidate authorization inside `withAuthorizedWorkspaceTransaction`; request-origin checks are also required for browser-originated writes.

## Separate identity and privilege boundaries

- **External clients:** use `ClientPortalGrant`, scoped to organization, workspace, client and user. Capabilities are explicit (status, tasks, evidence upload), and grant expiry/revocation is rechecked in the transaction. A staff role does not grant portal access.
- **External partners:** there is no general-purpose partner account/organization grant model in the current implementation. Do not treat a public partnership inquiry as an approved partner or grant access by inference. Issue #25 remains open for this lifecycle.
- **Platform administrators:** `PlatformSuperAdmin` and explicit `PlatformAdministratorPermission` records are independent of workspace roles. A workspace Owner or Admin is not automatically a platform administrator. Super Admin provisioning/transfer uses trusted operator workflows and audit records; there is no self-service privilege elevation.
- **Browser state:** client-supplied role/permission values and hidden UI controls are never authorization. Resolve the current server session and live database assignments.

## Required controls for new routes

1. Origin validation for browser-originated mutations.
2. Authentication and active workspace/principal validation.
3. Permission check on the server.
4. Zod validation of untrusted payloads.
5. Resource lookup constrained by active workspace and, where relevant, organization/client.
6. Authorized transaction revalidation for sensitive writes.
7. Audit event in the same transaction for material access/grant/status changes.
8. Tests for missing permission, cross-workspace IDs, revoked/expired grants, and no side effects on denial.

## Known gaps tracked by Issue #25

- No general external professional-partner grant lifecycle with purpose-specific scopes and expiry.
- Role names and permission mapping are centralized, but the matrix is not yet an interactive policy simulator or configurable role editor.
- The complete endpoint-by-endpoint resource authorization audit and regression suite remains in progress.
- Operational audit retention, export/tamper-evidence, and recovery controls require explicit deployment decisions.
