# Dependency Remediation Execution Record

Updated: 2026-10-19
Canonical pull request: [#69](https://github.com/Ebisindo/pieroloos-platform/pull/69)
Canonical branch: `security/npm-dependency-remediation-diagnostics`
Schema baseline: [PR #62](https://github.com/Ebisindo/pieroloos-platform/pull/62), branch `fix/main-prisma-graph-schema-clean-repair`

## Current disposition

Keep PR #69, PR #62 and PR #64 open and in draft. No merge, deployment or production migration has been performed. Green candidate checks are necessary but do not replace a qualified independent security review and database/schema review.

The candidate was successfully validated in isolated CI on source head `b90c88c7cefe89785ba2c0085ac847e9ad33dd37`. Its generated package manifest and lockfile were then committed to the remediation branch by the publisher job, resulting in head `84eaae8d8c7f9fd92a418490faba236cf2b17f3a`. The manifest and lockfile now agree on ESLint `10.13.0` and Next.js `16.4.2`.

## Candidate evidence

- [Candidate validation on push — run #39266564797](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39266564797) — success. The job validated the generated npm candidate and published its package files.
- Full dependency audit: zero vulnerabilities across info, low, moderate, high and critical severity in the generated candidate.
- Production-only dependency audit: zero vulnerabilities across all severity levels.
- PostgreSQL migration/schema validation and integrity tests: passed; database-integrity suite reported 10/10 tests passed, including the concurrent compliance-generation route test.
- ESLint: 0 errors, 32 warnings. Existing warnings remain visible; no rule was disabled to force a pass.
- Typecheck, unit tests and production build: passed.
- Unit tests: 448 passed, 10 skipped.
- Playwright: 32 passed.

These results prove the generated candidate passed in its isolated workflow on source head `b90c88c7cefe89785ba2c0085ac847e9ad33dd37`. They do not, by themselves, establish that every GitHub-required check has passed on the subsequent package-file commit `84eaae8d8c7f9fd92a418490faba236cf2b17f3a`.

## ESLint support and compatibility

The official [ESLint support matrix](https://eslint.org/version-support/) lists v10.x as the current release line and v9.0.0–v9.39.5 as end-of-life from 6 August 2026. The candidate therefore moves to ESLint `10.13.0` rather than accepting the unsupported ESLint 9 warning.

The previous ESLint 10 attempt was rejected because `eslint-plugin-jsx-a11y@6.10.2` declares a peer range ending at ESLint 9. The candidate removes that incompatible plugin and uses `@eslint-react/eslint-plugin`, `@eslint/js`, TypeScript ESLint, and React Hooks rules in flat config. It does not use `--force`, `--legacy-peer-deps`, manually edited lockfiles, or suppressed lint failures.

## Latest-head GitHub checks

When this record was updated, GitHub had marked the newly synchronized PR runs on `84eaae8d8c7f9fd92a418490faba236cf2b17f3a` as `action_required` and returned no workflow jobs. The runs were triggered by `github-actions[bot]` after it committed the generated package files:

- [CI — run #39267134143](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267134143)
- [Security checks — run #39267134364](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267134364)
- [Dependency remediation diagnostics — run #39267134088](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267134088)
- [Candidate validation (PR) — run #39267134114](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267134114)

These are not passing or failing code checks; they are blocked before jobs execute. Re-trigger/authorize workflows through an eligible human-authored repository action, then verify every required workflow against the resulting exact head. If GitHub still reports `action_required`, a repository owner must approve the run in GitHub Actions.

## Mandatory independent reviews

No independent review submissions are recorded for PR #69, #62 or #64.

1. Security review: inspect the complete manifest/lockfile diff, both npm audit reports, action SHA pinning, dependency-audit fallback, CI permissions, and artifact-publishing workflow. Confirm that no credential or untrusted artifact can alter production code without review.
2. Database/schema review: inspect PR #62 corporate-graph models and inverse relations, Prisma migrations, tenant boundaries, referential integrity, and the integrated compliance-generation idempotency/recovery behavior in PR #69. The recovery retry is limited to fresh, authorization-checked reads and does not replay obligation writes.

Review requests are recorded in [PR #69 conversation](https://github.com/Ebisindo/pieroloos-platform/pull/69) and [PR #62 conversation](https://github.com/Ebisindo/pieroloos-platform/pull/62), but comments do not count as formal approvals. Only a qualified reviewer independent of the implementation author can close these gates.

## Consolidation and release order

- PR #62 is the schema baseline and must be reviewed and integrated before the dependency/security candidate is retargeted to the accepted base.
- PRs #63, #64, #66 and #67 overlap on CI/security workflow changes. Do not merge them as parallel alternatives. PR #69 currently carries the integrated pinned-action and npm-audit fallback changes alongside the dependency candidate; compare final workflow diffs before closing superseded PRs.
- After PR #62 is accepted, retarget/rebase the canonical PR #69 on the accepted main branch, regenerate/recheck if the base changes, and require all CI, security, database/schema and review gates on its final head.
- Track the 32 remaining lint warnings as technical debt; they are visible warnings, not suppressed errors.

## Merge control

Do not merge until (a) all required checks pass on the final exact head, (b) the ESLint 10-compatible manifest and lockfile remain reproducible, (c) independent security and database/schema approvals are recorded, (d) overlapping workflow changes are reconciled, and (e) the final base/branch-protection plan is reviewed.

No merge, deployment, production migration, payment, filing or other external business action is authorized by this record.
