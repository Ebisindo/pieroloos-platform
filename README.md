# PieroloOS Prisma Package

This package establishes the Prisma configuration and PostgreSQL-ready schema foundation for `Ebisindo/pieroloos-platform`.

## Files

- `prisma/schema.prisma` — domain schema
- `prisma.config.ts` — Prisma CLI configuration
- `prisma/seed.ts` — safe empty-by-default seed
- `prisma/migrations/` — migration directory
- `.env.example` — required database environment variable

## Install

From the project root:

```bash
npm install
```

## Validate

```bash
npx prisma validate
```

## Format

```bash
npx prisma format
```

## Generate client

```bash
npx prisma generate
```

## Development migration

After setting a real `DATABASE_URL`:

```bash
npx prisma migrate dev --name init
```

Do not commit real `.env` files or database credentials.

## Important

The schema is a coherent product-platform baseline for the PieroloOS domain. Before applying migrations to an existing database, compare it with any existing Prisma models/migrations in the repository and reconcile rather than blindly overwriting them.
