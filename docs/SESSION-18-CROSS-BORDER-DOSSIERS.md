# Session 18 — Cross-border transaction preparation dossiers

Session 18 adds a workspace-scoped place to organize a contemplated cross-border activity before professionals assess the relevant requirements.

## Delivered

- Added a dossier linked to a workspace client, origin and destination jurisdictions, counterparty details, a user-described activity, optional value/currency, and optionally a matching market-entry pathway.
- Added user-authored preparation controls with statuses and links to workspace/client documents.
- Added optimistic version checks and append-only dossier audit events for dossier creation, control creation/status updates, evidence links, and professional review.
- Requires every applicable control to be complete and required evidence to be linked before an internal `REVIEWED` outcome can be recorded.
- Added the Cross-border Preparation workspace route.

## Deliberate boundary

A dossier organizes preparation only. The platform does not execute payments, assess counterparties, clear imports or exports, determine sanctions/export-control applicability, confirm banking or currency availability, or certify that a transaction is permitted. Controls are authored and evaluated by workspace users and qualified professionals using current authoritative sources. `REVIEWED` is an internal workflow outcome, not government authorization or a transaction clearance.

## API

- `GET/POST /api/cross-border/dossiers` — list and create workspace-scoped dossiers.
- `POST /api/cross-border/dossiers/[id]/controls` — add a user-defined preparation control.
- `PATCH /api/cross-border/dossiers/[id]/controls/[controlId]` — update control status against the current dossier version.
- `POST /api/cross-border/dossiers/[id]/controls/[controlId]/evidence` — link a document for the dossier client.
- `POST /api/cross-border/dossiers/[id]/review` — record a professional review outcome and note.

## Deployment

Use the explicit validation, migration, and drift-check procedure in [Session 19 — Production Data Integrity & Migration Control](./SESSION-19-PRODUCTION-DATA-INTEGRITY.md). A migration's presence in Git does not prove that a database has been migrated or verified.

Apply `prisma/migrations/20261005224500_cross_border_dossiers` using the normal database migration process after verifying the intended PostgreSQL target.
