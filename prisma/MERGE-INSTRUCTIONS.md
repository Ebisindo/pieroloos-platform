# Prisma Schema and Migration Instructions

`prisma/schema.prisma` is the active data model. `prisma/migrations/` is the authoritative, ordered PostgreSQL migration history; the target database's `_prisma_migrations` table records which entries have been applied.

The `prisma/session-*.prisma` files are historical reference fragments, not active schema inputs and not migrations. Do not merge or apply them during deployment.

For a production-safe deployment, use the Session 19 procedure in [docs/SESSION-19-PRODUCTION-DATA-INTEGRITY.md](../docs/SESSION-19-PRODUCTION-DATA-INTEGRITY.md). It validates and generates the client, deploys committed migrations, checks applied migration status, compares migration history to the Prisma schema, and compares the target database to the schema.

Use `npm run db:migrate:dev -- --name <description>` only for local development when creating a migration. Review and commit the generated SQL migration before deployment. Never use `migrate dev` against staging or production.
