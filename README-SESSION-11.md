# PieroloOS — Session 11
## Evidence-Aware Command Center & Operational Intelligence

Additive package for Sessions 01–10.

Includes:
- evidence-aware operational intelligence
- Command Center evidence summary
- compliance evidence signals
- operational audit model
- workspace authorization boundary
- tenant-scoped object storage abstraction
- report evidence service
- operational UI widgets
- audit timeline
- Prisma addition
- tests
- architecture documentation

Installation:

```bash
git checkout -b feature/evidence-aware-command-center
```

Merge `prisma/session-11-operational-intelligence.prisma` into the established `prisma/schema.prisma`.

Then:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name evidence-aware-operational-intelligence
npm test
```

Commit:

```bash
git add .
git commit -m "feat: connect evidence intelligence to operational control center"
git push -u origin feature/evidence-aware-command-center
```

Production integration order:
1. authenticated session principal
2. workspace-scoped repositories
3. PostgreSQL document/obligation repositories
4. S3-compatible object storage
5. security scanning/background processing
6. audit repository
7. replace API fixtures
8. Command Center integration
9. Compliance Control Center integration
10. report generation
11. integration/e2e tests

Never expose unrestricted document downloads or bypass organization/workspace authorization.
