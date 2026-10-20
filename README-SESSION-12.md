# PieroloOS — Session 12
## Unified Operational Control Plane, Tasks & Evidence Escalation

This package is cumulative: it contains Session 11 plus the Session 12 additions.

### Core transition

```text
Signal
  ↓
Action
  ↓
Assignment
  ↓
Deadline
  ↓
Execution
  ↓
Escalation
  ↓
Review
  ↓
Resolution
  ↓
Audit
```

### Main additions

- Operational Action domain model
- Explicit action state machine
- Priority model
- Deadline handling
- Escalation policy engine
- Signal-to-action factory
- Idempotent active-action detection
- ControlPlaneService
- EscalationService
- Action repository contract
- Action authorization helpers
- Audit boundary for action events
- Action queue UI
- Action status badge
- Escalation banner
- API integration boundaries
- PostgreSQL/Prisma-ready action schema
- Escalation event schema
- Unit tests
- Professional-service boundary documentation

### Install

```bash
git checkout -b feature/unified-operational-control-plane
```

Merge:

```text
prisma/session-12-control-plane.prisma
```

into the established `prisma/schema.prisma`.

Then:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name unified-operational-control-plane
npm test
```

Commit:

```bash
git add .
git commit -m "feat: introduce unified operational control plane"
git push -u origin feature/unified-operational-control-plane
```

### Important production work

Session 13 adds audited assignment, transition, and resolution commands with optimistic concurrency. Its escalation worker claims actions with compare-and-swap and writes escalation events plus a tenant-scoped notification outbox record in the same PostgreSQL transaction. The Command Center shows workspace- and recipient-scoped in-app notices. Production still requires scheduler configuration, external delivery providers, end-to-end database verification, and broader integration/e2e coverage.

### Continuation status

Client intake, Command Center metrics, and operational action reads remain scoped to the active workspace. Trusted evidence-gap action creation derives its signal from workspace data and writes its action and creation audit event transactionally. Action assignment, lifecycle transitions, and resolution now use audited, concurrency-checked writes. Only evidence-gap action creation is enabled because other trusted signal sources are not yet available. In-app notices are available to their intended recipients; external delivery and the production scheduler are not configured. Production database behavior and migrations still require verification against the intended PostgreSQL environment.

Do not expose unrestricted action mutation endpoints.

Do not treat workflow deadlines as statutory or legal deadlines unless they are sourced from the jurisdiction-aware compliance obligation system.
