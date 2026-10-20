# PieroloOS Platform — Session 02 Package

This package is an additive development session for the `pieroloos-platform` repository.

## Installation

1. Keep the existing `pieroloos-platform` project from Session 01.
2. Copy the contents of this package's `lib/` into the repository's `lib/` directory, replacing the Session 01 lib files where names overlap.
3. Replace `prisma/schema.prisma` with the Session 02 version.
4. Copy the new documentation files into `docs/`.
5. Run dependency installation from the project root.
6. Generate the Prisma client.
7. Run type checking before starting the development server.

## Expected commands

```bash
npm install
npx prisma generate
npm run typecheck
npm run dev
```

A database migration should only be run after `DATABASE_URL` points to the intended development PostgreSQL database.

## Git commit

```text
feat: establish pieroloos domain and data foundation
```
