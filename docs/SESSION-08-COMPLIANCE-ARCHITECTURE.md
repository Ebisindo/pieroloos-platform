# PieroloOS — Session 08: Compliance Operations

Formation Outcome
→ Compliance Obligation Register
→ Jurisdiction/Context Rule Evaluation
→ Deadlines
→ Evidence
→ Reminders
→ Escalation
→ Compliance Status

## Principles
- Obligations are structured records, not free-form checklist items.
- Jurisdiction rules must be versioned and source-aware.
- Deadlines derive from explicit base events.
- Evidence is first-class.
- Reminders are operational records for later queue/worker dispatch.
- Escalation is traceable through activity history.
- Professional review remains a first-class state.
- Internal workflow status must not be presented as a legal/regulatory conclusion.
- Never hard-code jurisdiction-specific legal requirements without verified sources.

## Next integration
When a FormationPlan reaches formation-completed:
1. record the formation outcome;
2. resolve the active jurisdiction rule pack;
3. generate obligation candidates;
4. persist obligations;
5. calculate deadlines;
6. attach evidence requirements;
7. schedule reminder candidates;
8. expose unresolved/overdue items in Command Center;
9. escalate according to policy;
10. update compliance portfolio status.
