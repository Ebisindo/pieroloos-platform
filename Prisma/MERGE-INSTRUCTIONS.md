# Session 08 Prisma Merge Instructions

Do not replace `prisma/schema.prisma`.

1. Open the existing schema.
2. Keep the existing generator and datasource.
3. Merge the Session 08 enums/models.
4. Resolve relations against existing Client, BusinessProfile, FormationPlan, Document and User models.
5. Run `npx prisma format`.
6. Run `npx prisma validate`.
7. Run `npx prisma generate`.
8. Create the migration only after validation succeeds.
