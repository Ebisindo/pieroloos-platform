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

The API routes intentionally remain integration boundaries. Before production use, connect them to:

1. real authentication/session resolution
2. organization/workspace-scoped repositories
3. domain services
4. durable audit persistence
5. notification workers
6. PostgreSQL transactions
7. idempotency constraints
8. optimistic locking
9. authorization tests
10. integration/e2e tests

### Continuation status

Client intake now resolves an authenticated workspace principal, requires formation-write permission, and scopes persistence to that principal's organization and workspace. Command Center client, engagement, and report metrics are also scoped to the active workspace. The operational-action read API and Command Center queue use the active workspace and compliance-read permission. Trusted evidence-gap action creation now checks the active workspace's obligation/evidence state and transactionally writes the action and creation audit event with a database idempotency constraint. These connections cover only those paths; other API routes remain integration boundaries until reviewed and connected individually.

Still outstanding for production deployment are append-only audit coverage for every action mutation, notification workers and delivery idempotency, explicit optimistic-lock/version columns, authorization coverage across routes, and integration/e2e coverage. Only evidence-gap action creation is enabled; transition and resolution remain disabled pending those controls. PostgreSQL transaction behavior must also be verified against the production database and worker concurrency model.

Do not expose unrestricted action mutation endpoints.

Do not treat workflow deadlines as statutory or legal deadlines unless they are sourced from the jurisdiction-aware compliance obligation system.
