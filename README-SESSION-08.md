# PieroloOS — Session 08
## Compliance Obligation Register & Compliance Operations Engine

This session connects formation outcomes to jurisdiction/context-aware compliance operations.

### Included
- Compliance domain model
- Jurisdiction-aware obligation generation
- Deadline calculation
- Evidence requirements
- Reminder scheduling contracts
- Portfolio status logic
- Validation schemas
- API boundaries
- Prisma additions
- Compliance UI primitives
- Automated engine test
- Architecture documentation

### Merge safely
This is an additive package. Do not overwrite Sessions 01–07.

```bash
git checkout -b feature/compliance-obligation-engine
```

Merge `prisma/session-08-compliance.prisma` into the existing schema, resolve existing relations, then:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name compliance-obligation-engine
npm test
git add .
git commit -m "feat: introduce compliance obligation engine"
git push -u origin feature/compliance-obligation-engine
```

### Next logical session
Session 09: Command Center compliance intelligence, deadline monitoring, background reminders, escalation policies, evidence/document persistence, notification infrastructure and compliance portfolio views.
