# Session 26 — Client Portal & External Collaboration

## First-release scope

The initial client portal supports only:

- Authenticated client access to status for the explicitly granted client record.
- Read-only visibility of tasks and compliance requests that a professional has explicitly published.
- Derived evidence next actions from published unsatisfied evidence requirements.
- Evidence upload to the granted client record, followed by the existing private storage, retention, quarantine, checksum, malware-scanner, and professional review lifecycle.
- Visibility of the client's own uploaded evidence and scan/review status; downloads are available only after the document is clean, available, current, and still within the grant scope.

There are no client-side task state changes or completion, comments, messaging, signatures, approvals, or legal/professional determinations in this slice.

## Access model and controls

- Client identities use the configured OIDC/GitHub authentication. Authentication admits a user if the user is an organization member or has an active client-portal grant. Grant lifecycle and workspace/client IDs—not the login identity—authorize portal data. Grant-only OIDC access requires the provider's verified-email claim; GitHub access is checked against its authenticated `/user/emails` response.
- A workspace client manager can grant access only to the case-insensitive email on the client record. Granting provisions a portal-only user record if needed; no local credentials are created. Access can be revoked and is checked again inside each serializable data/write transaction. The professional team must send the client the portal URL and instruct them to authenticate with the matching verified OIDC/GitHub account; outbound invitation email is not implemented.
- Grants carry explicit status, task, and evidence-upload scopes. They are scoped by organization, workspace, client, and user; composite PostgreSQL foreign keys bind grant and audit rows to a workspace/client from the same tenant.
- Portal-visible task, formation-task, and obligation flags default to false. The workspace can publish/unpublish only a resource proven to belong to the client and workspace. Every grant, revocation, publication, view, evidence-list, upload, and download URL request is audit-recorded.
- Client portal evidence upload cannot set arbitrary client, engagement, obligation, or evidence links. The server forces the granted client ID and strips those links; writes re-check the upload grant after storage and clean up the object if the grant was revoked before persistence.
- Documents remain inaccessible until the existing scanner transitions them to clean/available. Portal download links are short-lived and issuance is audited.

## Implementation

The data contract and migration are in `prisma/schema.prisma` and `prisma/migrations/20261006183000_client_portal_access`. Access checks are in `lib/auth/client-portal-access.ts`; grant and portal data logic is in `lib/services/client-portal-service.ts`; the client surface is `/portal`. Workspace grant management and publication are exposed through:

- `GET/POST /api/clients/{clientId}/portal-access`
- `DELETE /api/clients/{clientId}/portal-access/{grantId}`
- `PATCH /api/clients/{clientId}/portal-visibility`

The client surface is exposed through:

- `GET /api/portal/clients/{clientId}`
- `GET/POST /api/portal/clients/{clientId}/documents`
- `GET /api/portal/clients/{clientId}/documents/{documentId}/download`

The workspace Clients page now exposes grant/revocation and task publication controls. Outbound invitation email is not implemented; granting access provisions a user record but does not send a message.

## Verification and open production gates

Prisma schema validation/client generation and focused tenant/access tests must pass. Before production exposure, replay the migration on disposable PostgreSQL, test revoked/expired/cross-tenant grants and concurrent revocation during upload, configure and verify OIDC email identity assurance and client invitation delivery, check logging/retention and account recovery, and test scanner outage, infected evidence, and storage recovery.
