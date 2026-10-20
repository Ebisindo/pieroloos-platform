# Session 22 — Notification & Background Job Infrastructure

Session 22 extends the existing notification table into a durable outbox and adds an authenticated, externally scheduled delivery worker. The first external provider is SMTP. Delivery is **at least once**: database uniqueness and worker leases prevent routine duplicate enqueue and concurrent claims, and SMTP `Message-ID` is stable across retries, but generic SMTP cannot guarantee exactly-once delivery after a provider accepts a message and the worker loses its connection before persisting that receipt.

## Event, outbox, and worker

- Operational escalation commits its event and creates one deduplicated in-app notification plus one email outbox row in the same PostgreSQL transaction.
- `ComplianceNotification` is the outbox record. Its tenant-scoped unique key is the enqueue idempotency key. It stores status, schedule, retry state, a worker lease, provider receipt, and the immutable template key/version selected when the event was enqueued.
- `POST /api/workers/notifications` claims a bounded batch of due rows by conditional state transition. Rows with an expired five-minute lease can be recovered after worker interruption. The endpoint uses the constant-time `OPERATIONAL_WORKER_SECRET` bearer check.
- In-app delivery records a delivery attempt and changes the row to `SENT`; the Command Center shows its delivery state.
- The recipient's Command Center inbox shows both in-app and email delivery states; SMTP success is labelled as provider acceptance, and failed/dead-letter notices show the safe failure summary.
- SMTP delivery uses a deterministic `Message-ID` derived from the notification ID. A successful SMTP response is recorded as provider acceptance and receipt. This is not proof of mailbox placement, open, or read; generic SMTP has no portable delivery-status-notification guarantee.
- The notification worker route also exposes authenticated `GET /api/workers/notifications` status counts, oldest queued time, and dead-letter count. Individual errors are reduced to safe error codes in logs and persisted failure summaries.

## Retry and dead-letter policy

Delivery attempts are persisted with start/completion time, attempt number, accepted provider ID, and normalized failure code. Transient errors use exponential delays starting at 30 seconds, doubling per attempt, capped at six hours, with five attempts by default. Permanent template/configuration errors and permanent SMTP 5xx responses are dead-lettered immediately. Dead-lettered rows are excluded from automatic delivery and remain visible through the worker status API and database for operator review. After investigation, an operator can explicitly re-drive a row using `POST /api/workers/notifications/{id}/redrive`; this records an activity audit event and grants one additional bounded cycle of five attempts. Never clear delivery-attempt history to make a failed notification appear successful.

If a process stops during delivery, the lease allows recovery. Since SMTP cannot deduplicate on behalf of all providers, a crash after remote acceptance but before receipt persistence can produce a duplicate on lease recovery. Consumers should treat the stable message ID and notification ID as the idempotency identity.

## Recipient preferences and quiet hours

Each user can change their own preferences in the Command Center or through `GET/PATCH /api/notifications/preferences`. Settings are per workspace. In-app is enabled by default; email is opt-in and disabled until explicitly enabled. A workspace-level notifications-off setting suppresses all channels. The worker also verifies that the recipient still has membership in the notification's organization.

Quiet hours are optional local times in a validated IANA timezone. They defer email until the next minute outside the interval, including intervals that cross midnight; in-app inbox delivery is not delayed. Preference opt-out cancels queued items rather than sending them later.

## Templates and configuration

Email rows pin a `templateKey` and `templateVersion`. The initial `operational-action-escalation@1` and `legacy-notification@1` renderers escape HTML content; unknown versions fail closed and are dead-lettered rather than silently rendered with a different template.

Configure SMTP through deployment secrets:

```text
SMTP_HOST=<provider host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=<optional; must be paired with password>
SMTP_PASSWORD=<optional; must be paired with username>
SMTP_FROM=<verified sender address>
SMTP_MESSAGE_ID_DOMAIN=<optional; defaults to domain in SMTP_FROM>
OPERATIONAL_WORKER_SECRET=<high-entropy scheduler bearer secret>
```

The transport enforces TLS certificate verification, requires STARTTLS when implicit TLS is not selected, and applies connection/greeting/socket timeouts. Provider credentials must be scoped to sending only. Do not put secrets in the repository or expose the worker token to clients.

## Scheduler and operations

There is deliberately no in-process timer: web instances scale independently and may stop at any time. The repository includes [a GitHub Actions scheduler](../.github/workflows/notification-scheduler.yml) that runs escalation evaluation and a five-row notification batch every five minutes or by manual dispatch. Configure the repository secrets `PIEROLOOS_APP_URL` (origin only, without a trailing slash) and `OPERATIONAL_WORKER_SECRET`. GitHub scheduled workflows are best effort and can be delayed; a production deployment with a strict delivery SLO should use its managed cloud scheduler instead, calling the same authenticated endpoints:

- `POST /api/workers/notifications?limit=5` for due notification delivery. The bounded batch keeps processing within the worker lease and scheduler execution window.
- `POST /api/workers/notifications/{id}/redrive` for a reviewed dead-letter replay.
- `POST /api/workers/escalations` to evaluate overdue operational actions and enqueue idempotent notification events.
- `GET /api/workers/notifications` for queue-health monitoring and dead-letter alarms.

Alert on increasing dead-letter count, oldest queued age above the operational SLO, repeated worker 5xx responses, and queue growth. The scheduler must retry its own failed HTTP invocation. SMTP-provider-specific delivery-status integration remains an operator/deployment decision; no claim of downstream mailbox delivery is made by the generic adapter.

## Migration and verification

Apply `20261006063620_notification_job_infrastructure` using the controlled Session 19 migration pipeline. It adds retry/lease/template/receipt state, recipient preference storage, and appendable delivery attempt history. Deploy the migration before code that queries the added columns. Verify the migration against a disposable PostgreSQL database, then separately confirm scheduler auth, queue recovery, SMTP acceptance, provider rejection, retry timing, opt-out, quiet hours, and dead-letter monitoring in a staging environment.

## Exit gate not yet satisfied

Code and local automated checks do not prove production delivery. Before treating Session 22 as production-ready, configure a real SMTP account and scheduler, test provider-specific bounce/complaint processing, establish retention and access controls for notification data, alert on worker/queue health, and exercise recovery from both a transient provider outage and a worker crash.
