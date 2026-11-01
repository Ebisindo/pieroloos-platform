# Security Incident and Recovery Runbook

## Status and safety boundary

This runbook is an operator checklist, not evidence that monitoring, alert delivery, backups, or restoration are configured. The architecture records gaps in structured/redacted logging, worker-failure alerting, audit tamper evidence, and backup/restore rehearsal. Until an owner records successful tests below, treat these controls as **unverified**.

Use approved organization incident channels and the configured hosting, database, object-storage, identity, email, and monitoring consoles. Never put credentials, tokens, private keys, production records, client documents, or sensitive request bodies in GitHub issues, pull requests, chat, or incident notes.

Do not perform a production restore, destructive database operation, secret rotation, deployment, or customer notification solely because this document exists. Follow the incident commander and service owner's authorization process.

## Roles and escalation

Assign named people and tested contact methods before launch; do not leave placeholders at incident time.

| Role | Responsibility |
| --- | --- |
| Incident commander | Owns severity, timeline, decisions, and coordination |
| Security lead | Leads containment, access review, evidence preservation, and disclosure assessment |
| Service/database owner | Assesses application, PostgreSQL, migration, and recovery integrity |
| Storage owner | Assesses private object storage, access policy, and document integrity |
| Privacy/legal contact | Determines applicable notification, retention, and legal obligations |
| Communications owner | Approves accurate internal and external status updates |

If a role or escalation channel is unassigned or untested, record that as a launch blocker and escalate to the accountable service owner.

## Severity guide

- **SEV-1 — suspected/confirmed tenant data exposure, credential compromise, unauthorized privileged action, malicious production change, or broad outage:** page the incident commander and security lead immediately; preserve evidence and contain without destroying it.
- **SEV-2 — repeated authorization failures, suspected abuse/exfiltration, worker compromise, persistent provider/storage/database failures, or material data-integrity concern:** engage the service owner and security lead promptly; increase monitoring and assess scope.
- **SEV-3 — isolated defect or degraded non-critical workflow with no current evidence of compromise or data loss:** create a tracked incident, assign an owner, and set a review deadline.

Severity is provisional. Escalate when scope is unknown, tenant isolation may be affected, or evidence suggests a higher impact.

## First response checklist

1. Record detection time (UTC), reporter, affected environment/services, observed symptoms, correlation/request IDs, and current uncertainty. Use opaque record identifiers where possible.
2. Open a restricted incident record and appoint an incident commander. Maintain a timestamped decision log with actor, action, rationale, and outcome.
3. Preserve relevant provider audit events, application/deployment logs, database metadata, object-storage access events, and workflow/job identifiers before short retention windows expire. Store evidence only in the approved restricted location.
4. Assess impact across organization/workspace boundaries, authentication and authorization, platform-admin actions, private documents, scheduled workers, external providers, and data integrity.
5. Contain using the smallest reversible action that prevents ongoing harm: disable a compromised integration or worker, revoke affected credentials/sessions, block a malicious path at the trusted edge, or isolate an affected workload. Record who authorized each action.
6. Do not delete logs, overwrite evidence, expose raw payloads in tickets, or make speculative public claims. Do not run destructive cleanup or restore over production while scope is uncertain.
7. Notify the security, service, privacy/legal, and communications owners according to the incident severity and applicable obligations. Record the decision and rationale even when notification is not required.

## Credential and access compromise

- Identify the exact credential, principal, scope, environment, and likely exposure window without copying the secret into the incident record.
- Revoke/rotate through the provider's approved secret manager and identity controls. Prefer revocation before replacement when compromise is active.
- Review recent authentication, permission/grant changes, admin activity, deployments, worker invocations, and provider usage for the affected identity.
- Verify least privilege, update the documented owner/rotation path, and test the replacement in a controlled environment.
- Do not paste live values into GitHub, CI logs, screenshots, or this runbook.

## Data integrity and tenant-isolation incident

- Stop the suspected unsafe operation or route through the approved control plane; preserve relevant request IDs and audit metadata.
- Identify affected organization/workspace/client records and time range using authorized, read-only queries where possible.
- Compare application audit events with PostgreSQL and object-storage metadata. Treat audit tables as insufficient tamper evidence until an independent integrity mechanism is implemented and tested.
- Do not infer that a missing record means no access or no impact. Document uncertainty and independent verification.
- Require security and database-owner approval before any corrective production write. Preserve before/after evidence and use a reviewed, reversible repair plan.

## Backup and restore procedure

This section is **not executable until the deployment owner fills in and rehearses every environment-specific step**.

1. Confirm that PostgreSQL and private object storage are both covered by the approved backup policy; a database-only backup may not recover uploaded documents.
2. Record encryption, access restrictions, retention, backup frequency, integrity checks, and the named backup owner in the deployment's restricted operations record.
3. Select a known backup and restore it into an isolated, access-controlled recovery environment. Never experiment by restoring over production.
4. Validate database availability, migration state, referential/integrity checks, tenant boundaries, object references, document hashes/scan state, and the application's read-only health/readiness behavior.
5. Record the actual start/end times, restore point, measured recovery time, observed data-loss window, failures, and independent reviewer. Do not claim RPO/RTO until measured.
6. Rehearse the documented rollback/forward-fix and re-isolation steps. Confirm temporary recovery credentials and data are securely removed after approval.
7. If restoration fails, preserve the failed attempt's logs, keep the incident escalated, and do not declare recovery complete.

### Restore rehearsal evidence

- Environment and date/time (UTC):
- Backup identifier and backup timestamp (no credentials):
- Database and object-storage coverage:
- Restore start/end and measured duration:
- Integrity and tenant-isolation checks performed/results:
- Object/document integrity checks performed/results:
- Measured data-loss window:
- Failures and remediation issues:
- Operator and independent reviewer:
- Follow-up owner and due date:
- Decision: pass / fail / blocked:

## Recovery and return to service

1. The incident commander confirms containment and authorizes recovery with the relevant service/security owners.
2. Restore from a verified recovery point or deploy a reviewed fix using the normal change process. Validate migrations in an isolated environment first.
3. Rotate/revoke compromised credentials and invalidate affected sessions/tokens where appropriate.
4. Verify authentication, workspace authorization, tenant isolation, database integrity, private storage access, worker behavior, rate limiting, and relevant external integrations.
5. Increase monitoring and use a staged return to service where supported. Confirm alert delivery rather than relying only on a healthy HTTP response.
6. Record residual risk, affected users/tenants, data reconciliation, communications/notification decisions, and who approved service restoration.

## Post-incident review

Within the organization's defined review window, document the timeline, root cause and contributing factors, confirmed and possible impact, detection/containment/recovery effectiveness, data-loss window, notification decisions, and corrective actions. Each action needs an owner, due date, acceptance test, and linked issue. Avoid blame and do not include secrets or unnecessary personal data.

## Launch-readiness acceptance checklist

- [ ] Named incident commander, security, database, storage, privacy/legal, and communications contacts are assigned and reachable.
- [ ] Structured logs are redacted and include correlation IDs across authentication, privileged actions, documents, providers, and workers.
- [ ] Alerts for repeated authorization denials, cross-tenant probes, privilege changes, bulk exports, worker dead letters, rate-limit abuse, and provider failures have been tested end to end.
- [ ] PostgreSQL and private object storage backup policies are documented, access-controlled, encrypted, and monitored.
- [ ] An isolated restore rehearsal passed, including database integrity, tenant isolation, and object/document integrity; evidence above is complete and independently reviewed.
- [ ] Audit access, retention, export, and tamper-evidence controls are reviewed.
- [ ] Health and readiness checks distinguish application liveness from database, storage, and worker dependency health.
- [ ] The production rate-limit strategy is effective across instances and trusts client IP headers only from configured trusted proxies.
- [ ] Relevant tests and security review pass on the exact release commit.
- [ ] Release owner explicitly accepts remaining risks; unresolved critical/high risks block launch unless formally approved under the organization's risk process.

Track implementation and evidence against the existing security monitoring/recovery issue and production release gate. This checklist does not close either issue automatically.
