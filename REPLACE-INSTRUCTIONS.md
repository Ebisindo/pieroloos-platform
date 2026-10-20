# PieroloOS CI + source-code correction package

Target repository: `Ebisindo/pieroloos-platform`
Target branch: `main`

Baseline: CI run #222, commit `b3dc6eb106e051d03ac1b1339da63027d894c6bb`.

## Replace these files

Copy the package files into the repository at the same paths:

- `.github/workflows/ci.yml`
- `package.json`
- `lib/db/client-repository.ts`
- `lib/db/business-profile-repository.ts`
- `lib/db/engagement-repository.ts`
- `lib/db/compliance-repository.ts`
- `lib/db/evidence-repository.ts`
- `lib/db/jurisdiction-repository.ts`
- `lib/services/client-service.ts`
- `lib/services/business-profile-service.ts`
- `lib/services/compliance-service.ts`
- `lib/services/evidence-intelligence.ts`
- `lib/services/jurisdiction-service.ts`
- `lib/services/jurisdiction-engine.ts`
- `lib/domain/compliance.ts`
- `lib/domain/document-integrity.ts`
- `lib/domain/jurisdiction.ts`
- `app/api/clients/intake/route.ts`
- `app/clients/[id]/route.ts`
- `app/api/jurisdictions/compare/route.ts`
- `app/jurisdictions/page.tsx`
- `app/engagements/[id]/page.tsx`

## Required deletion

Delete this existing repository file:

`components/ui/Primitives.tsx`

Keep:

`components/ui/primitives.tsx`

The CI failure includes TypeScript TS1261 because both files exist and differ only by casing.

## What this package fixes

- Prisma Client generation before typechecking
- Prisma 6 version alignment with the existing `prisma-client-js` generator
- Prisma schema validation in CI
- Client repository fields mapped to the actual Prisma Client model
- BusinessProfile JSON persistence mapped to the actual schema
- Engagement and Activity fields mapped to the actual schema
- Compliance status/progress mismatch
- Evidence type import mismatch
- Jurisdiction repository mapped to the actual schema
- Jurisdiction service/domain interface mismatch
- Web Crypto BufferSource typing
- implicit-any errors caused by previously untyped repository results
- duplicate UI primitive filename casing
- intake API response compatibility
- production build explicitly regenerating Prisma Client

## Commit

After copying/deleting the files, commit everything together:

`fix: align prisma domain model and production CI`

## CI sequence

The corrected workflow is:

Install dependencies
→ Generate Prisma Client
→ Validate Prisma schema
→ Typecheck
→ Test
→ Production build

Do not disable TypeScript, tests, or build validation to force a green check.

## Important

This is a targeted replacement package, not a full repository archive. It contains the files changed for the current CI/source mismatch set. Existing repository files not listed above should remain untouched.
