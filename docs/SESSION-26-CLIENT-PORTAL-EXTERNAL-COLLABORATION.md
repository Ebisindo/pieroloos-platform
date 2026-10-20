# Session 26 — Client Portal & External Collaboration

## Portal scope

The portal supports authenticated client status and task visibility, evidence upload,
client completion submissions, client-visible messages, and authenticated acknowledgment
requests. Every task, formation task, or obligation remains hidden until a professional
publishes it for that client.

Client completion is recorded as a submission for professional review. It does not change
the underlying task, formation, or compliance lifecycle. Staff may accept the submission
or request changes; any workflow state transition still follows the owning workflow and its
evidence/review gates.

An acknowledgment request contains the exact text the professional wants acknowledged.
The client must explicitly check an acknowledgment confirmation and submit while
authenticated. PieroloOS records the actor, time, request relationship, exact text, and
SHA-256 content hash. This is an auditable acknowledgment, not a legally binding
electronic signature, identity-proofing service, or professional approval. No client or
staff interaction can substitute for a regulated/legal determination.

Portal messages are visible to the client and the workspace staff handling that client
record. Internal staff notes are not part of the portal interaction model. Evidence files
continue to use the separate secure document lifecycle and should not be sent as message
attachments.

## Access model and controls

- Client identities use the configured OIDC/GitHub authentication. Authentication admits a user if the user is an organization member or has an active client-portal grant. Grant lifecycle and workspace/client IDs—not the login identity—authorize portal data. Grant-only OIDC access requires the provider's verified-email claim; GitHub access is checked against its authenticated `/user/emails` response.
- A workspace client manager can grant access only to the case-insensitive email on the client record. Granting provisions a portal-only user record if needed; no local credentials are created. Access can be revoked and is checked again inside each serializable data/write transaction. The professional team must send the client the portal URL and instruct them to authenticate with the matching verified OIDC/GitHub account; outbound invitation email is not implemented.
- Grants carry explicit status, task, and evidence-upload scopes. They are scoped by organization, workspace, client, and user; composite PostgreSQL foreign keys bind grant and audit rows to a workspace/client from the same tenant.
- Portal-visible task, formation-task, and obligation flags default to false. The workspace can publish/unpublish only a resource proven to belong to the client and workspace. Every grant, revocation, publication, view, evidence-list, upload, and download URL request is audit-recorded.
- Completion submissions, messages, acknowledgment requests, and acknowledgments are scoped to the same organization, workspace, client, actor, and active grant where applicable. Resource-linked interactions require a published resource. Interactions are separately audit-recorded.
- A pending completion submission is deduplicated per client/resource. Professional acceptance records a review outcome but deliberately does not mutate the task or obligation state.
- Acknowledgment request closure and the acknowledgment row are written in the same serializable grant-checked transaction. The acknowledgment stores the exact request text and server-calculated SHA-256 hash; the original request content remains available through its parent relationship.
- Client portal evidence upload cannot set arbitrary client, engagement, obligation, or evidence links. The server forces the granted client ID and strips those links; writes re-check the upload grant after storage and clean up the object if the grant was revoked before persistence.
- Documents remain inaccessible until the existing scanner transitions them to clean/available. Portal download links are short-lived and issuance is audited.

## Implementation

The data contract and migrations are in `prisma/schema.prisma`, `prisma/migrations/20261006183000_client_portal_access`, and `prisma/migrations/20261009180000_client_portal_collaboration`. Access checks are in `lib/auth/client-portal-access.ts`; grant and portal data logic is in `lib/services/client-portal-service.ts`; the client surface is `/portal`. Workspace grant management and publication are exposed through:

- `GET/POST /api/clients/{clientId}/portal-access`
- `DELETE /api/clients/{clientId}/portal-access/{grantId}`
- `PATCH /api/clients/{clientId}/portal-visibility`
- `GET/POST /api/clients/{clientId}/portal-interactions`
- `PATCH /api/clients/{clientId}/portal-interactions/{interactionId}` (professional review of a client completion submission)

The client surface is exposed through:

- `GET /api/portal/clients/{clientId}`
- `GET/POST /api/portal/clients/{clientId}/documents`
- `GET /api/portal/clients/{clientId}/documents/{documentId}/download`
- `GET/POST /api/portal/clients/{clientId}/interactions`

The workspace Clients page exposes grant/revocation, publication, client-visible messaging, acknowledgment requests, and review of completion submissions. The portal exposes responses, message history, and acknowledgment controls. Outbound invitation email and external email/push notification delivery are not implemented; new interactions appear in the portal and staff client inbox on reload. Granting access provisions a user record but does not send an invitation.

## Verification and open production gates

Prisma schema validation/client generation and focused tenant/access tests must pass. Before production exposure, replay the migration on disposable PostgreSQL; test revoked/expired/cross-tenant grants, concurrent revocation during upload and interaction creation, resource unpublishing during acknowledgment, and workspace authorization. Configure and verify OIDC email identity assurance and client invitation delivery, check logging/retention and account recovery, and test scanner outage, infected evidence, and storage recovery. External notifications and legally binding e-signatures require separate, explicit integrations.
