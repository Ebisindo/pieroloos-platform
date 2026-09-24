# PieroloOS — Session 12
## Unified Operational Control Plane, Tasks & Evidence Escalation

Session 12 changes the operational model from:

Signal → Dashboard

to:

Signal → Action → Assignment → Deadline → Execution → Escalation → Review → Resolution → Audit

## 1. Control-plane principle

A signal is an observation.

An action is an operational commitment.

PieroloOS should never silently convert every signal into an obligation. Action creation is an explicit workflow decision and should remain auditable.

## 2. Action lifecycle

OPEN
→ ASSIGNED
→ IN_PROGRESS
→ PENDING_REVIEW
→ RESOLVED

Exceptional paths:

ASSIGNED → BLOCKED
IN_PROGRESS → BLOCKED
BLOCKED → IN_PROGRESS
OPEN/ASSIGNED/IN_PROGRESS/BLOCKED → CANCELLED

Terminal states:

RESOLVED
CANCELLED

Invalid state transitions are rejected by the domain layer.

## 3. Evidence escalation

Critical evidence conditions can create an operational action such as:

"Replace rejected evidence"

"Provide missing compliance evidence"

"Review evidence before report release"

The action carries the originating signal, obligation, document, client and engagement context where available.

## 4. Deadlines

Actions may carry a `dueAt` deadline.

The escalation engine evaluates overdue actions using explicit policy thresholds:

- Level 1: 24 hours
- Level 2: 72 hours
- Level 3: 120 hours

These are operational defaults, not regulatory deadlines. Jurisdiction-specific statutory deadlines must come from authoritative obligation data.

## 5. Idempotency

Creating an action from a signal checks for an existing active action with the same signal ID inside the organization/workspace boundary.

This prevents repeated dashboard refreshes or background processing from generating duplicate actions.

For distributed production workers, add a database uniqueness constraint or idempotency key before enabling concurrent job execution.

## 6. Concurrency protection

Action updates use an `expectedUpdatedAt` value.

If the stored record changed after the actor loaded it, the command is rejected rather than silently overwriting another user's update.

Production repositories should strengthen this with an explicit optimistic-lock/version column.

## 7. Resolution control

An action cannot be resolved without a non-empty resolution note.

Resolution should eventually support structured resolution evidence:

- document IDs
- activity IDs
- report IDs
- approval IDs
- external reference IDs

## 8. Authorization

Action reads and writes must remain organization/workspace scoped.

The production path is:

Authentication
→ Workspace Principal
→ Authorization
→ Repository
→ Domain Service
→ Audit

Never authorize an action solely because a user knows its ID.

## 9. Audit

Action creation, assignment, transition, escalation and resolution should create durable audit events.

Audit events should be append-only.

## 10. Background worker boundary

A production worker should periodically:

1. load active actions
2. evaluate deadlines
3. calculate escalation
4. persist escalation level
5. append escalation event
6. enqueue notification
7. avoid duplicate notifications using an idempotency key

The worker must not make legal or regulatory conclusions.

## 11. Professional-service boundary

Operational deadlines and escalation thresholds are workflow controls.

They are not substitutes for jurisdiction-specific filing deadlines, professional advice or government requirements.

## 12. Session 13 direction

The next architectural transition should connect the control plane to:

- unified task management
- notification orchestration
- approval workflows
- client/engagement timelines
- compliance deadline intelligence
- report release controls
- background workers
- durable notification delivery
- richer Command Center action management
