# Prisma merge

1. Open `prisma/schema.prisma`.
2. Preserve Session 06 jurisdiction models.
3. Merge `prisma/session-07-additions.prisma`.
4. Resolve naming conflicts instead of duplicating existing models.
5. Run:

```bash
npx prisma format
npx prisma generate
npx prisma migrate dev --name formation-operations-engine
```

Production creation should eventually be transactional:
Decision + Plan + Stages + Tasks + Evidence Requirements + Activity Event.
