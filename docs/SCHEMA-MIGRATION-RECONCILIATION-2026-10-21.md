# Current-main schema and migration reconciliation — 21 October 2026

## Baseline
- Base branch: main
- Baseline commit: 4c6a3cb080962913c1bf5b2ba4220702e8111b7f
- Security workflow PR #88 is merged. Its main-head CI and Security workflows passed on this baseline.
- Existing canonical registry remains ComplianceRule + ComplianceRuleVersion. Existing corporate graph tenant-integrity migration remains unchanged.

## Scope of this candidate
This candidate adds a relational BusinessIntentEvidenceReference table and PostgreSQL guards on top of current main. It intentionally does not copy the stale schema or workflow files from PR #39. That branch diverged substantially from current main and contains an older corporate graph edge relation shape, so it must not replace the current schema.

## Guard properties
- Proposal, document, optional client, and workspace are linked with tenant-scoped foreign keys.
- The trigger validates that the proposal's client matches the reference, that the document belongs to the same workspace/client and points to the same evidence record, and that the document is available, clean, verified and not deleted.
- The evidence source must be independently VERIFIED, have an E3/E4 evidence class, an HTTPS source and a retrieval timestamp.
- The trigger runs on updates to identity fields and to claim/verification fields, preventing a row update from bypassing the validation.
- A document's workspace/client/evidence identity cannot be rebound after a reference exists.

## Verification and release boundary
GitHub Actions must validate Prisma schema/client generation and replay the complete migration history on a disposable PostgreSQL database at the exact PR head. Add behavioral tests for cross-workspace, mismatched-client, mismatched-document/evidence, unverified evidence, claim mutation and concurrent revoke/bind behavior before treating this slice as release-ready. Do not run a production migration from this candidate.
