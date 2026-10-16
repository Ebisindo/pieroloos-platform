# PieroloOS v2 — Corporate Graph and Evidence-Governed Compliance

This increment adds a workspace-scoped Corporate Graph Studio and a source-attributed compliance rule assessment foundation to the existing Next.js + Prisma application.

## Included
- Workspace-scoped entity nodes and ownership/control/relationship edges.
- Existing membership-role checks, authorization transaction pattern and workspace scoping.
- Graph validation: no self-links, bounded ownership percentages, duplicate prevention and ownership-cycle rejection.
- Accessible corporate graph screen with entity creation and relationship listing.
- Compliance rules with jurisdiction, official-source metadata, effective dates, review status, version, evidence class and human-review requirements.
- Compliance assessment endpoint that returns source gaps and requires professional review when evidence is not ready.

## Explicit limits
This is a source-governed compliance foundation, not a populated statutory database. No jurisdiction's legal obligations should be represented as verified until the primary source has been recorded and reviewed by an authorized professional. No active rules are seeded by this migration. AI output may propose a structure but cannot approve incorporation, determine a definitive tax position, file government forms, or mark an obligation completed.

## Verification
Run `npm run db:generate`, `npm run db:validate`, `npm run db:inventory`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Apply the additive migration using `npm run db:deploy`. Do not use `prisma db push` in production.
## New routes
- `/corporate-graph`
- `GET /api/corporate-graph`
- `POST /api/corporate-graph/nodes`
- `POST /api/corporate-graph/edges`
- `GET /api/compliance/rules?jurisdiction=NG&entityType=COMPANY`
