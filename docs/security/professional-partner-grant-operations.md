# Professional Partner Grant Operations

Status: implementation specification accompanying PR #36. Production activation is blocked until Issue #32 gates, independent security review, legal/privacy review, backup verification and deployment approval are complete.

## Operating workflow

1. **Register the identity.** Authorized workspace managers attach an existing authenticated user to a partner organization/contact record. Public partnership inquiries, email addresses and staff roles are not grants. The subject cannot self-register as a partner. Identity starts as `PENDING_VERIFICATION`.
2. **Verify independently.** A reviewer other than the partner subject and the identity creator verifies or rejects the identity with a timestamp and an explanatory note. A verified identity is not yet authorized to access any client.
3. **Request a client-specific grant.** An authorized workspace manager selects one client, one engagement purpose, a finite capability list and expiry. Unknown fields are rejected. Default expiry is 90 days; maximum finite duration is 365 days. A no-expiry grant must be explicitly requested by an owner and should be exceptional.
4. **Approve separately.** Another authorized manager reviews pending terms. The grant creator or partner subject cannot approve it. Activation only succeeds while the identity remains verified and the grant expiry remains in the future.
5. **Re-scope or revoke.** Every term amendment immediately sets an active grant back to `PENDING_REVIEW`, removes its effective access, and clears approval metadata until an independent review. Revocation is terminal and requires an actor, timestamp and reason. Suspending the partner identity denies access across all grants.
6. **Perform partner work.** Each partner read/write checks the authenticated user, grant/client/workspace/organization, exact capability, active status, expiry, revocation, verified identity and staff-membership exclusion inside a serializable transaction. Authorization locks grant and identity rows to serialize against revocation/suspension. Successful operations append an access audit event in the same transaction. Evidence uploaded by a partner is only `E2/PENDING`; it cannot self-promote to verified primary evidence.
7. **Review and monitor.** Workspace managers review pending decisions, expiring grants, access audits, repeated denials and recovery/redrive actions. Expired grants are treated as denied on every request even before any administrative status update.

## Capability policy

- `CLIENT_PROFILE_READ`: minimal client/business identity fields required for the engagement.
- `COMPLIANCE_READ`: obligation titles, states and due dates; no broad access to internal notes or unrelated evidence.
- `DOCUMENT_METADATA_READ`: metadata only; raw file access is not inferred and requires its own controlled file-delivery design.
- `EVIDENCE_ATTACH`: attach eligible evidence to an open obligation for internal review; submissions start E2/PENDING.
- `GRAPH_READ`: read-only, client-scoped corporate graph.
- `REPORT_READ`: read/download specifically authorized client report artifacts, not unrestricted storage access.

A grant does not imply another capability; the backend requires the exact capability for each operation. Do not add wildcard, admin, write-all, user-management or grant-management capabilities. Partner identities cannot approve their own identity/grant, change their own authorization or receive a parallel tenant-staff role in the same organization.

## Audit and evidence integrity

Identity lifecycle events, grant creation/review/amendment/revocation and successful partner operations create append-only audit records. Denied attempts are returned without grant business-data or success-audit side effects; edge/security telemetry may separately record redacted denials. Do not put secret tokens, complete document contents or unnecessary personal data in metadata. Use stable record IDs, actor IDs, action names, timestamps, reason hashes where suitable and prior/new state summaries.

Grant idempotency uses a one-way digest of the request key and a separate digest of effective scope/terms. Reusing a key with different terms must return a conflict and never widen the existing grant.

## Retention, export and recovery assumptions

These are proposed operational assumptions, not legal determinations or production settings:
- Retain grant/identity decision and partner-access audit events for **7 years by default**, subject to counsel-approved jurisdictional retention schedule and applicable deletion/legal-hold requirements. Never mutate an event to satisfy a deletion request; apply an approved redaction/subject-erasure procedure with preserved non-identifying integrity evidence where legally required.
- Retain raw documents only under the document's existing retention policy. Partner evidence links must not extend a source document's retention. Expired, quarantined, deleted or non-clean documents are unavailable for partner actions.
- Restrict exports to organization owners or a separately reviewed audit-export permission. Export only tenant-scoped fields; exclude secrets and file bytes by default. Generate an audit entry with exporter, scope, filters, time range, result count, timestamp and checksum. Encrypt artifacts at rest and in transit, expire download URLs, and never use public links.
- Proposed recovery objectives for review: **RPO ≤ 24 hours** for audit/metadata and **RTO ≤ 8 hours** for restoring the service in a controlled environment. These are planning targets, not promises; confirm against the actual managed PostgreSQL/storage backup configuration and restore exercises.
- Before any production migration: take a verified point-in-time/database backup, verify restore access, run additive migration on a non-production copy, validate row counts/FKs/check constraints/triggers, confirm rollback/forward-repair steps, and capture the approver and backup evidence in Issue #32.
- Recovery workers must use least-privilege service identity, bounded retries, deduplication and dead-letter queues. Manual redrive must authenticate an operator, verify scope and record an immutable reason/audit event; never reset approval/revocation history.

## Manual security review checklist

- [ ] Confirm partner identity verification source/registration evidence and independent reviewer separation.
- [ ] Walk every partner endpoint, server action, download/export route and background job; verify exact capability and resource ownership.
- [ ] Attempt organization/workspace/client/obligation/document ID substitution, cross-tenant object references, stale workspace, stale grant and role-confusion attacks.
- [ ] Race concurrent revocation/suspension against reads/writes and confirm row locking/serializable retries deny later operations.
- [ ] Verify CSRF/origin validation, secure session cookies, account email verification, account recovery and external identity-provider behavior.
- [ ] Verify least-data responses, output encoding, CSV/JSON formula injection resistance and no raw document access from metadata-only capabilities.
- [ ] Inspect append-only database triggers and audit export authorization; attempt to update/delete audit records.
- [ ] Run the full CI suite on the latest PR head; resolve all findings and obtain independent code/security review.
- [ ] Have legal/privacy reviewers approve retention periods, access purposes, jurisdictional obligations and subject-rights procedures.
- [ ] Verify a restore from backup and record evidence before requesting production release approval.

## Release constraints

This specification and PR do not authorize production migration, deployment or access provisioning. Issue #32 remains the release gate. A green CI run is necessary but is not a substitute for human security/legal review, verified backup/restore evidence or deployment approval.
