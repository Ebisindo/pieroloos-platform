# Session 14 — Market-entry pathways

Session 14 connects saved jurisdiction analysis to a persistent workstream for establishing or expanding into a target market.

## Delivered

- Added workspace-scoped market-entry pathways created only from saved jurisdiction comparisons linked to a business profile.
- Validated that the selected target was part of the saved comparison and remains available to the workspace.
- Linked pathways to the existing working jurisdiction decision and optionally to a formation plan for the same profile and target jurisdiction.
- Added explicit `ASSESSING → IN_PROGRESS → PAUSED → COMPLETED` lifecycle transitions with optimistic version checks.
- Required a recorded professional review before a pathway can enter execution or be marked complete.
- Added append-only audit events for pathway creation, lifecycle updates, and professional review.
- Added a Market Expansion page connected to the existing Jurisdiction Lens, Formation, and workspace navigation.

## API

- `GET /api/market-entry` — list pathways in the active workspace.
- `POST /api/market-entry` — create from a saved comparison and selected target jurisdiction.
- `PATCH /api/market-entry/[id]` — update lifecycle with `expectedVersion`.
- `POST /api/market-entry/[id]/review` — record a reviewer decision with note and `expectedVersion`.
- `POST /api/market-entry/[id]/formation-plan` — link a formation plan for the same profile and target jurisdiction with `expectedVersion`.

All mutation routes require authenticated workspace membership, same-origin browser requests, and the appropriate workspace permissions. Review notes and state changes are audited.

## Deliberate boundary

A pathway is an internal planning record. It does not determine whether a market is suitable or whether incorporation, licensing, tax registration, banking, or government acceptance is available. Jurisdiction comparison inputs retain their existing evidence and professional-review limitations. No unsupported market facts are generated or inferred.

## Validation

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm run typecheck
npm test
```

Apply `prisma/migrations/20261005223000_market_entry_readiness` through the deployment's normal migration process only after confirming the intended PostgreSQL target.
