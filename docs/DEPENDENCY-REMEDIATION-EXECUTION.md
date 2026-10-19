# Dependency Remediation Execution Record

Updated: 2026-10-19
Canonical pull request: [#69](https://github.com/Ebisindo/pieroloos-platform/pull/69)
Canonical branch: `security/npm-dependency-remediation-diagnostics`
Current verified head at this record: `da9fada9b64655312d8acf74d44fc5bf52064732`
Schema baseline: [PR #62](https://github.com/Ebisindo/pieroloos-platform/pull/62), branch `fix/main-prisma-graph-schema-clean-repair`

## Current disposition

Keep PR #69, PR #62 and PR #64 open and in draft. No merge, deployment or production migration has been performed. The dependency candidate and required automated checks have now passed on the exact head listed above, but merge readiness is still blocked by missing independent security and database/schema approvals and by the need to reconcile overlapping security-workflow alternatives.

## Exact-head checks

The following pull-request workflow runs completed successfully on `da9fada9b64655312d8acf74d44fc5bf52064732`:

- [CI — run #39267604934](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267604934) — quality and E2E jobs passed.
- [Security checks — run #39267604895](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267604895) — npm audit, CodeQL and Gitleaks passed.
- [Dependency remediation diagnostics — run #39267604884](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267604884) — passed, including clean lockfile reproducibility and manifest/lock consistency.
- [Candidate validation — run #39267604880](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267604880) — passed.
- [Candidate validation and tested-candidate publication — push run #39267595212](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267595212) — passed on the same head; no extra package-file commit was required.

Candidate validation reported:
- Full npm dependency audit: 0 findings across info, low, moderate, high and critical severity.
- Production-only npm audit: 0 findings across all severity levels.
- npm-generated lockfile is reproducible with `npm ci`; direct dependency declarations previously set to `latest` are pinned.
- PostgreSQL schema/migration validation and data-integrity tests passed; the database suite passed 10/10 checks.
- ESLint 10.13.0 completed with 0 errors and 32 warnings. Warnings remain visible and should be addressed as technical debt; lint rules were not disabled to manufacture a pass.
- TypeScript typecheck passed.
- Unit tests: 448 passed, 10 skipped.
- Production build passed.
- Playwright: 32 passed.

These checks validate the candidate and tested repository code at the recorded head. Re-run the required checks on any subsequent commit or base-branch change before merging.

## ESLint support and compatibility

The official [ESLint support matrix](https://eslint.org/version-support/) marks v10.x as current and v9.0.0–v9.39.5 as end-of-life from 6 August 2026. The candidate uses ESLint `10.13.0`, Next.js `16.4.2`, and the ESLint 10-compatible flat-config stack `@eslint/js`, `typescript-eslint`, `@eslint-react/eslint-plugin`, `eslint-plugin-react-hooks` and `globals`.

The older `eslint-config-next` / `@next/eslint-plugin-next` chain and the React plugins whose declared peer ranges rejected ESLint 10 were removed from this candidate. The generated manifest/lockfile passed npm reproducibility checks; npm was not run with `--force` or `--legacy-peer-deps`, and the lockfile was not manually edited.

One code error surfaced under the new rules in document-storage cleanup error handling. The code was adjusted to preserve the original persistence failure as the aggregate error's cause while retaining the cleanup failure in `AggregateError.errors`. The current exact-head lint run passes with 32 warnings and no errors. Separately track and resolve the warnings, particularly the security-relevant `dangerouslySetInnerHTML` warning and un-aborted browser fetches, using appropriately scoped tests and review.

## Independent review requirements

No independent review submissions are recorded for PR #69, PR #62 or PR #64. Formal review requests and scopes have been recorded in the PR conversations:
- [PR #62 database/schema review request](https://github.com/Ebisindo/pieroloos-platform/pull/62#issuecomment-6269472365)
- [PR #64 security-workflow consolidation request](https://github.com/Ebisindo/pieroloos-platform/pull/64#issuecomment-6269473647)
- [PR #69 independent security review request](https://github.com/Ebisindo/pieroloos-platform/pull/69#issuecomment-6269474890)

These comments are requests, not completed reviews or approvals. A qualified reviewer independent of the implementation author must submit an actual GitHub review.

Security review scope: the complete dependency manifest/lockfile diff, full and production audit artifacts, pinned third-party action references, workflow permissions, audit fallback, candidate-artifact publishing/provenance, and whether untrusted workflow output could alter production code without review.

Database/schema review scope: PR #62 corporate-graph models and inverse relations, canonical ComplianceRule/ComplianceRuleVersion registry compatibility, tenant/workspace boundaries, migrations, unique/index constraints, referential integrity, and the exact tested corporate-graph and compliance-generation transaction/idempotency behavior. Reviewers should explicitly approve or request changes and cite evidence.

## Consolidation and merge order

- PR #62 is the schema baseline and must receive independent database/schema approval before it is integrated into `main`.
- PRs #63, #64, #66 and #67 overlap on CI/security workflow changes. PR #69 currently carries the dependency candidate and the integrated audit/Action-pinning workflow path. Compare the remaining workflow diffs and retain each unique control once; do not merge the competing alternatives independently.
- After PR #62 is reviewed and accepted, retarget/rebase the canonical PR #69 to the accepted base, then regenerate/reverify as needed. A base or head change invalidates the old exact-head evidence.
- PR #64 remains a draft as requested while its unique controls are reconciled.
- Keep the 32 current lint warnings visible; prioritize potentially security-sensitive warnings and create separately tested fixes rather than broadly relaxing lint rules.

## Merge control

Do not merge until (1) all required checks pass on the final exact head and current base, (2) ESLint 10 and the generated lockfile remain reproducible, (3) independent security and database/schema approvals are recorded, (4) overlapping workflow changes are reconciled, and (5) GitHub's required-review/branch-protection rules are satisfied.

No merge, deployment, production migration, payment, filing or other external business action is authorized by this record.
