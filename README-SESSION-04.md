# PieroloOS Session 04 — Client Intake & Business Profile Engine

This session turns the PieroloOS shell into a persistent business workflow.

## Scope
- Structured client intake
- Draft/published intake states
- Fact / assumption / unresolved-information classification
- Zod validation
- Client service + repository boundary
- Business Profile creation/update
- Engagement creation
- Intake-to-profile workflow
- Activity/audit event preparation
- API route foundation
- Typed domain contracts

## Install
Merge the contents into the existing `pieroloos-platform/` repository.

Then run:
```bash
npm install
npx prisma generate
npm run typecheck
npm run dev
```

If a PostgreSQL DATABASE_URL is configured, apply the Prisma migration in your normal development workflow.

## Commit
Suggested commit:
`feat: implement client intake and business profile engine`
