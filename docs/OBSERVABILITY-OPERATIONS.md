# Observability and Operational Monitoring

## Implementation status

This document defines the initial operational contract. It is not evidence that a log sink, alert destination, backup schedule, or restore rehearsal is configured. The structured logger currently has a deliberately small event allow-list and is integrated with the database health endpoint only. Broader route/worker instrumentation and end-to-end alert delivery remain release blockers tracked by Issue #57.

## Structured event contract

Operational events are JSON objects with a fixed schema:

- `event`: a known event name from the logger's TypeScript union.
- `level`: `info`, `warn`, or `error`.
- `correlationId`: a server-generated UUID; the health endpoint returns it in the response body and `x-correlation-id` header.
- `dependency`, `outcome`, and `durationMs`: optional bounded operational metadata.

Do not add arbitrary objects or free-form request/provider data to this logger. Never emit authorization headers, cookies, session IDs, access tokens, secret values, SQL parameters, raw request bodies, client names, document contents, or private object keys. Exceptions must be normalized to a reviewed event code; do not serialize exception objects because driver/provider errors can contain sensitive infrastructure details.

A correlation ID is for tracing a single request across approved logs, not an authentication factor or authorization claim. Do not trust a client-supplied correlation ID as a security identity.

## Alert implementation plan

The following thresholds are initial operational proposals and must be tuned against staging traffic before production enforcement:

| Signal | Initial trigger | Required response |
| --- | --- | --- |
| Authorization denials | Sustained increase over the normal baseline or repeated denials from one principal/network | Inspect route, tenant scope and actor metadata without collecting request bodies |
| Cross-tenant probes | Any confirmed foreign-tenant access attempt or unexpected resource-scope mismatch | Page security owner; preserve request IDs and audit metadata |
| Privilege/grant changes | Every platform-admin permission or privileged grant mutation | Notify restricted operator channel and verify actor/target |
| Bulk exports/downloads | Threshold by actor, tenant, volume and time window | Throttle or suspend only through approved controls; investigate scope |
| Worker failures/dead letters | Any critical worker dead-letter; repeated failures or oldest pending age above the agreed SLO | Notify service owner; inspect normalized failure codes and queue metadata |
| Rate-limit abuse | Repeated limit hits across routes or a sudden traffic anomaly | Review edge and shared-store signals; avoid logging raw IPs unless approved and retained appropriately |
| Provider failures | Consecutive failures or failure rate above a staging-calibrated threshold | Notify service owner; check provider status and credential health without exposing secrets |
| Dependency readiness | Database/storage check fails or exceeds timeout | Mark readiness degraded and notify the owning operator |

Alert messages must include only event type, environment, time, correlation/incident identifier and a link to an access-controlled diagnostic view. Do not include sensitive payloads or credentials. Each alert needs a named owner, delivery destination, acknowledgement deadline, escalation path, and a periodic test proving delivery.

## Health and readiness

The current `GET /api/health` checks PostgreSQL reachability and returns a generic 503 when the query fails. It includes a server-generated correlation ID and logs only an allow-listed event. It does not yet verify private object storage, SMTP/provider health, worker queue age, alert delivery, or backup freshness. Do not treat HTTP 200 from this endpoint as proof of complete service readiness or recoverability.

Keep liveness (whether the process can run) separate from readiness (whether required dependencies can safely serve traffic) when deployment probes are configured. Dependency probes must have bounded timeouts and must never return configuration, connection strings, tenant data, or raw exception details.

## Required evidence before closing Issue #57

- [ ] Integrate safe structured events into authentication/authorization denials, privileged changes, exports/downloads, provider failures, uploads, and worker failure/dead-letter paths.
- [ ] Send redacted alerts to a restricted, named operator destination; demonstrate delivery, acknowledgement, escalation, and failure of the alert path itself.
- [ ] Tune and document thresholds from staging observations; record false-positive and missed-alert exercises.
- [ ] Inventory secret owner, environment, scope, rotation/revocation method, and emergency procedure in an approved restricted system; do not record secret values in GitHub.
- [ ] Document PostgreSQL and private object-storage backup coverage, encryption, retention, access control, integrity verification and owner.
- [ ] Rehearse restore in isolated staging, independently verify tenant and document integrity, and record measured recovery duration/data-loss window. Do not claim RPO/RTO until measured.
- [ ] Review audit retention, restricted reads/exports and a tamper-evidence strategy before schema changes.
- [ ] Run the full CI and security workflow on the exact reviewed commit and obtain independent security/database review.

No production credentials, deployment, data migration, backup, or restore action is authorized by this document.
