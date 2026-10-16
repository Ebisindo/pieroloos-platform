# PieroloOS v2 — Corporate Graph and Evidence-Governed Compliance

This increment extends the existing Next.js, Prisma and PostgreSQL application with a workspace-scoped Corporate Graph Studio and a source-attributed compliance-rule assessment foundation.

## Implemented in this increment

- Workspace-scoped corporate graph nodes and relationships with authorization transaction revalidation.
- Graph validation for self-links, ownership percentage bounds, relationship-specific ownership percentages, direct ownership totals, duplicate prevention and ownership-cycle rejection.
- Deterministic SVG graph layout and an accessible parallel entity/relationship inventory.
- Create, edit and archive entity operations; archive relationship operations; and a workspace-scoped recent graph activity timeline.
- Archival is non-destructive: archived entities and connected relationships are excluded from the active graph, while audit records and archive timestamps remain available.
- Graph audit events are written with the originating user and within the same authorized database transaction as the graph mutation.
- Loading, retryable failure, empty and success states with screen-reader status announcements.
- Compliance rules with jurisdiction, source metadata, effective dates, review status, version, evidence class and professional-review requirements.
- Compliance assessment endpoint that reports source gaps and requires professional review when evidence is incomplete.

## Limits and follow-on work

This remains a graph and compliance-assessment foundation. The graph lifecycle records changes and archives records but is not a legal approval system. It does not yet provide the full automatically scheduled statutory-obligation engine, AI intent provider, risk simulations or advisor approval workflow.

No jurisdiction's legal obligations should be represented as verified until primary-source evidence has been recorded and appropriately reviewed. No active rules are seeded by the migration. An empty rule registry does not imply that no obligations exist. AI outputs, when implemented, must remain reviewable proposals and must not approve incorporation, determine definitive tax positions, file government forms or mark obligations completed without the required authority.

## Verification

Run the repository's actual CI scripts: `npm run db:generate`, `npm run db:validate`, `npm run db:inventory`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build` and `npm run test:e2e`, with the required PostgreSQL test service configured. Record any blocked check and its reason. Apply migrations using `npm run db:deploy` only through the documented release procedure after review and backup verification. Do not use `prisma db push` in production.

## Routes

- `/corporate-graph`
- `GET /api/corporate-graph`
- `POST /api/corporate-graph/nodes`
- `PATCH /api/corporate-graph/nodes/[id]`
- `DELETE /api/corporate-graph/nodes/[id]` (archives entity and active connected relationships)
- `POST /api/corporate-graph/edges`
- `DELETE /api/corporate-graph/edges/[id]` (archives relationship)
- `GET /api/corporate-graph/audit`
- `GET /api/compliance/rules?jurisdiction=NG&entityType=COMPANY`
