# PieroloOS v2 — Corporate Graph and Evidence-Governed Compliance

This increment extends the existing Next.js, Prisma and PostgreSQL application with a workspace-scoped Corporate Graph Studio and a source-attributed compliance-rule assessment foundation.

## Implemented in this increment

- Workspace-scoped corporate graph nodes and relationships.
- Existing membership-role checks, authorization transaction pattern and workspace scoping.
- Graph validation for self-links, bounded ownership percentages, relationship-specific ownership percentages, duplicate prevention and ownership-cycle rejection.
- Direct ownership percentage-total validation so recorded direct ownership percentages for one entity cannot exceed 100%.
- Deterministic spatial graph layout rendered as SVG, with the equivalent entity and relationship inventory retained for accessible use.
- Loading, retryable failure, empty and success states with screen-reader status announcements.
- Compliance rules with jurisdiction, source metadata, effective dates, review status, version, evidence class and professional-review requirements.
- Compliance assessment endpoint that reports source gaps and requires professional review when evidence is incomplete.

## Limits and follow-on work

This is a graph-visualization and compliance-assessment foundation. It does not yet provide graph edit/archive operations, full graph change history, an automatically scheduled statutory-obligation engine, an AI intent provider, risk simulations or advisor approval workflow.

No jurisdiction's legal obligations should be represented as verified until primary-source evidence has been recorded and appropriately reviewed. No active rules are seeded by the migration. An empty rule registry does not imply that no obligations exist. AI outputs, when implemented, must remain reviewable proposals and must not approve incorporation, determine definitive tax positions, file government forms or mark obligations completed without the required authority.

## Verification

Run the repository's actual CI scripts: `npm run db:generate`, `npm run db:validate`, `npm run db:inventory`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build` and `npm run test:e2e`, with the required PostgreSQL test service configured. Record any blocked check and its reason. Apply migrations using `npm run db:deploy` only through the documented release procedure after review and backup verification. Do not use `prisma db push` in production.

## Routes

- `/corporate-graph`
- `GET /api/corporate-graph`
- `POST /api/corporate-graph/nodes`
- `POST /api/corporate-graph/edges`
- `GET /api/compliance/rules?jurisdiction=NG&entityType=COMPANY`
