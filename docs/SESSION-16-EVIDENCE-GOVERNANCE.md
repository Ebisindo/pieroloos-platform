# Session 16 — Evidence governance and freshness

Session 16 makes evidence provenance, validity, and professional review part of the compliance workflow rather than treating an attachment as sufficient proof.

## Delivered

- Added source reference and optional validity date to compliance evidence records; validity dates cover the full selected calendar date.
- Added explicit `PENDING`, `VERIFIED`, and `CHANGES_REQUESTED` reviewer outcomes, reviewer identity, timestamp, and review note.
- Added an authenticated, workspace-scoped evidence review endpoint with an append-only compliance activity record.
- Updated compliance status changes so evidence-required obligations need at least one current, professionally verified evidence record before they can be marked compliant.
- Updated market-entry readiness to count only verified evidence whose validity date has not passed.
- Added evidence freshness and review controls to the Compliance workspace.

Source references and dates are user-entered tracking data. Verification is an internal professional review record; it does not certify that a document is legally valid or accepted by an authority.

## API

- `POST /api/compliance/obligations/[id]/evidence` — attach a workspace/client-scoped document with optional provenance and validity date.
- `PATCH /api/compliance/obligations/[id]/evidence/[evidenceId]/review` — record a permission-checked review decision and note.

## Deployment

Apply `prisma/migrations/20261005224000_evidence_governance` using the normal database migration process after verifying the intended PostgreSQL target.
