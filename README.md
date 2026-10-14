# PieroloOS

**Business Intelligence & Formation Platform.** From Business Idea to Business Infrastructure.

PieroloOS is a professional decision-support and workflow-organization platform. It organizes information, prepares drafts and analyses, tracks workflow and evidence, and supports human review. It does not replace licensed or regulated professionals or government authorities, and it does not guarantee incorporation, registration, approval or compliance outcomes.

## Documentation map

| Topic | Document |
| --- | --- |
| Positioning, capabilities, limitations, roadmap | [docs/PRODUCT.md](docs/PRODUCT.md) |
| Architecture, public site, data, authorization, evidence boundaries, environment, deployment, tests | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Brand and design tokens | [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) |
| Internationalization foundation and translation workflow | [docs/INTERNATIONALIZATION.md](docs/INTERNATIONALIZATION.md) |
| Partnership strategy and inquiry workflow | [docs/PARTNERSHIP.md](docs/PARTNERSHIP.md) |
| Sign-in providers and authorization | [docs/AUTH-SETUP.md](docs/AUTH-SETUP.md) |
| Platform Super Admin, permissions, provisioning and limits | [docs/ADMINISTRATION.md](docs/ADMINISTRATION.md) |
| Launch readiness checklist and pilot gate | [docs/SESSION-27-PRODUCTION-READINESS-PILOT-GATE.md](docs/SESSION-27-PRODUCTION-READINESS-PILOT-GATE.md) |
| Payment gateway implementation contract and current status | [docs/PAYMENTS-IMPLEMENTATION-PLAN.md](docs/PAYMENTS-IMPLEMENTATION-PLAN.md), [docs/PAYMENTS-IMPLEMENTATION-STATUS.md](docs/PAYMENTS-IMPLEMENTATION-STATUS.md) |
| Library layering | [docs/ARCHITECTURE-LIB.md](docs/ARCHITECTURE-LIB.md) |
| Lint/typecheck troubleshooting | [docs/LINT-PROJECT-DIRECTORY.md](docs/LINT-PROJECT-DIRECTORY.md) |
| GitHub Codespaces localhost:3000 preview and port forwarding | [docs/CODESPACES-PREVIEW.md](docs/CODESPACES-PREVIEW.md) |
| Permanent public pre-operation preview deployment standard | [docs/PERMANENT-PREVIEW-DEPLOYMENT.md](docs/PERMANENT-PREVIEW-DEPLOYMENT.md) |

The `README-SESSION-*`, `SESSION-*` and `docs/SESSION-*` files are historical delivery notes. A feature described only there is not evidence that it is implemented; check the code and tests.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in values; never commit secrets
npm run db:generate
npm run dev -- --hostname 0.0.0.0 --port 3000
```

For Codespaces port forwarding, preview access, environment safety, and troubleshooting, follow [docs/CODESPACES-PREVIEW.md](docs/CODESPACES-PREVIEW.md). This is a temporary developer preview, not permanent hosting. For the permanent public pre-operation preview standard, follow [docs/PERMANENT-PREVIEW-DEPLOYMENT.md](docs/PERMANENT-PREVIEW-DEPLOYMENT.md).

This repository uses a recent Next.js with breaking changes. Read the matching guide in `node_modules/next/dist/docs/` before changing framework-level code (see [AGENTS.md](AGENTS.md)).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit and route tests (no database required) |
| `npm run test:db` | Database integrity tests (requires PostgreSQL) |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:inventory` | Validate migration directory structure |
| `npm run db:deploy` | Apply migrations (see `scripts/db-deploy.mjs`) |
| `npm run build` | Generate Prisma client and build (requires `NEXTAUTH_SECRET`) |
