# Reality enhancements

## Provider coordination
Future tasks can reference formation providers, accountants, lawyers, registered agents, banking providers and government portals.

## Evidence chain
Task → Evidence → Source → Reviewer → Decision → Activity Event.

## Exceptions
Track blocker, owner, severity, created date, expected resolution, escalation and resolution evidence.

## Deadlines
Future tasks can carry target date, SLA, overdue state and escalation rules.

## Idempotency
External submissions must eventually use idempotency keys so retries cannot create duplicate submissions.

## Provider adapters
Keep external integrations behind adapters rather than inside the core domain.

## Versioned jurisdiction rule packs
A rule pack can define formation stages, evidence requirements, review gates, deadlines and source references.

Existing historical plans must retain their instantiated workflow when future rule packs change.

## Professional review
A review should be an event with reviewer, outcome, evidence, comment and timestamp—not merely a hidden Boolean.
