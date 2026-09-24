# Prisma merge instructions

Merge `prisma/session-06-additions.prisma` into the established Session 05 schema. Preserve existing Client, BusinessProfile, Engagement and Activity relations.

Then run:

```bash
npx prisma format
npx prisma generate
npx prisma migrate dev --name jurisdiction-intelligence-engine
```

For production, use the deployment migration workflow rather than `migrate dev`.
