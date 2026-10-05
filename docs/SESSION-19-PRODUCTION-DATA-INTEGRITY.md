# Session 19 — Production Data Integrity & Migration Control

Session 19 makes the data layer repeatable, verifiable, and deployment-safe. It establishes repository and CI controls; it does **not** claim that any staging or production database has been inspected or migrated.

## 19A — Migration inventory

`prisma/schema.prisma` is the active data model. `prisma/migrations/` is the sole authoritative migration history, and the target database's `_prisma_migrations` table records its applied state. Historical `prisma/session-*.prisma` files are reference fragments, not inputs to Prisma and not migrations.

Run `npm run db:inventory` to validate and print the ordered SQL migration directories. The current tracked history is:

| Order | Migration |
|---:|---|
| 1 | `20261005120000_operational_actions` |
| 2 | `20261005194739_verify_development_schema` |
| 3 | `20261005220000_operational_notifications` |
| 4 | `20261005223000_market_entry_readiness` |
| 5 | `20261005224000_evidence_governance` |
| 6 | `20261005224500_cross_border_dossiers` |
| 7 | `20261005233000_reconcile_notification_index_name` |

The inventory check rejects malformed/duplicate timestamps, empty or malformed SQL migration directories, and a migration lock with a non-PostgreSQL provider. A database-backed clean replay in CI validates that these migrations can be applied together.

## 19B — Drift detection

`npm run db:deploy -- <target>` compares both:

1. The committed migration history, replayed into a dedicated shadow database, against `prisma/schema.prisma`.
2. The selected target database against `prisma/schema.prisma`.

Both comparisons use Prisma `migrate diff --exit-code`. Any non-empty drift or failed migration status stops the process. The command generates Prisma Client from the validated schema before migration; CI then typechecks and builds against that generated client.

The generated client is a build artifact under `node_modules`, not a second source-controlled schema. Re-generating it from the checked-in schema and then typechecking/building is the repeatable client synchronization check.

## 19C — Environment verification

The deploy command requires the explicit target argument `local`, `staging`, `production`, or `ci`; it selects only the corresponding `DATABASE_URL_<TARGET>` and `SHADOW_DATABASE_URL_<TARGET>`. It rejects a target and shadow URL that name the same host, port, and database. Configure staging and production URLs through the deployment secret manager, never by committing credentials.

The shadow database must be dedicated and disposable: Prisma uses it to replay the migration history during drift checks. Do not point it at an application database. For local setup, provision the `pierolo_shadow` database once using a local PostgreSQL administrator account. Production deploy additionally requires:

```text
CONFIRM_PRODUCTION_MIGRATION=I_HAVE_VERIFIED_THE_PRODUCTION_TARGET
```

Runbook:

```bash
npm run db:deploy -- local
npm run db:deploy -- staging
npm run db:deploy -- production
```

Each command runs, in order: migration inventory, schema validation, client generation, committed migration deployment, migration status, migration-history/schema comparison, and target-database/schema comparison. Use `npm run db:migrate:dev -- --name <description>` only to author migrations against local development databases; do not use `migrate dev` for staging or production.

The checked-in `.env.example` contains only placeholder local connection values. Production/staging URLs and the production confirmation must be injected securely at deployment time. Always confirm the selected target and its intended PostgreSQL host/database before deployment.

## 19D — Migration pipeline

GitHub Actions starts a fresh PostgreSQL 16 service database and a separate shadow database, then runs the exact validate → generate → migrate → verify sequence. The job also checks applied migration status, compares migration history with the model, and compares the resulting live schema with the model. This catches clean-install failures as well as model/history drift before merge.

## 19E — Seed and reference data

`prisma/seed.ts` no longer creates a hard-coded personal user or grants an owner membership. It requires explicit `PIEROLO_SEED_*` organization/workspace values and a declared `PIEROLO_SEED_TARGET`; production seeding requires the same explicit target confirmation as migration deployment. The idempotent seed creates the selected organization/workspace and its `WorkspaceSettings` row, relying on versioned schema defaults. Before invoking `prisma db seed`, set `DATABASE_ENV` to the same target as `PIEROLO_SEED_TARGET`, set the target's `DATABASE_URL`, and provide the organization/workspace seed values. Seed execution is explicit and is not part of database migration deployment.

Evidence classes are Prisma enum values, not externally sourced data. Workspace workflow defaults are schema defaults. No jurisdiction or regulatory obligation records are seeded: jurisdiction records in the current model are workspace/organization context, and populating them with unsourced or unreviewed regulatory assertions would incorrectly imply authority. A vetted jurisdiction catalogue and its ownership/update policy remain prerequisites before such reference data is introduced.

## 19F — PostgreSQL integrity tests

CI runs `npm run test:db` against the migrated PostgreSQL service. It exercises database-enforced foreign keys, organization-scoped uniqueness, concurrent conflicting writes, and configured cascade deletion. For safety, the test runner permits only a `*_ci`, `*_test`, or `*_integration` database in CI; a local target requires an explicit confirmation flag. It refuses staging and production targets. For intentional local testing, set `DATABASE_ENV=local`, provide `DATABASE_URL` for a disposable local database, and set `CONFIRM_LOCAL_DB_TESTS=I_HAVE_VERIFIED_THE_LOCAL_TARGET` before `npm run test:db`.

Application-level cross-tenant authorization is not proven by these database constraints and remains a Session 20 exit requirement.

## Verification status

The repository pipeline and its clean PostgreSQL replay are the reproducible verification path. No production/staging connection is configured or exercised by this session. Therefore the statement “Git schema, generated client, and target database are synchronized” is only valid for a named target after the deployment command completes successfully against that target; it must not be inferred from CI or from migrations being present in Git.
