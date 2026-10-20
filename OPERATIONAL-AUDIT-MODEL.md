# Operational Activity vs Security Audit

Activity is the business-operational history of an engagement.

A future audit ledger should additionally capture actor, action, target, timestamp, request/session context and before/after state where appropriate.

Future architecture:

Application command
→ Domain event
→ Activity projection
→ Audit event
→ Notification / automation / analytics
