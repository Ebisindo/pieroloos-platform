# PieroloOS — Session 09
## Compliance Intelligence & Operational Control Center

This package advances Session 08 from a compliance register into an operational monitoring and control layer.

### Additive contents
- compliance control-center domain logic
- deadline/urgency classification
- portfolio snapshot calculation
- escalation policy and decision engine
- notification dispatcher boundary
- validation schemas
- repository contracts
- control-center API boundary
- control-center UI
- Prisma additions
- automated tests
- architecture documentation

### Safe integration

Do not overwrite Sessions 01–08.

```bash
git checkout -b feature/compliance-control-center
```

Merge `prisma/session-09-compliance-control.prisma` into the existing schema, preserving the existing generator/datasource and resolving existing organization/user relations.

Then:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name compliance-control-center
npm test
```

Commit:

```bash
git add .
git commit -m "feat: add compliance intelligence control center"
git push -u origin feature/compliance-control-center
```

The API examples intentionally use an adapter boundary and placeholder data. Connect them to the authenticated repository/service layer before production use.
