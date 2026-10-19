# Dependency Remediation Execution Record

Updated: 2026-10-19  
Canonical pull request: [#69](https://github.com/Ebisindo/pieroloos-platform/pull/69)  
Canonical branch: `security/npm-dependency-remediation-diagnostics`

## Latest verified PR-head evidence

Latest PR #69 head at this update: `da9fada9b64655312d8acf74d44fc5bf52064732`.

- [CI — PR run #39267604934](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267604934): success. Both quality/database and E2E jobs passed.
- [Security checks — run #39267604895](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267604895): success. npm dependency audit, CodeQL and Gitleaks jobs passed.
- [Dependency diagnostics — run #39267604884](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267604884): success.
- [ESLint 10 candidate validation — run #39267604880](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267604880): success. Candidate-generation, reproducible `npm ci`, PostgreSQL schema/migration and integrity checks, lint, typecheck, unit tests, production build and Playwright tests passed.
- The candidate artifact is [`next-eslint-prisma-override-candidate`](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39267604880). It is generated evidence, not proof that the candidate manifest/lockfile has already been applied to the PR branch.
- Full dependency audit and production-only audit each reported 0 vulnerabilities in the candidate artifact. The candidate lint step completed with 32 warnings and no errors; existing lint debt remains visible.

## ESLint support concern — candidate validated, branch application pending

The official [ESLint version-support policy](https://eslint.org/version-support/) lists ESLint 10.x as the current line and ESLint 9.39.5 as EOL beginning 2026-08-06. Therefore, the earlier ESLint 9.39.5 candidate was not acceptable for a maintained-support requirement even though its tests passed.

The updated candidate uses ESLint `10.13.0`, `@eslint/js`, `typescript-eslint`, `@eslint-react/eslint-plugin`, `eslint-plugin-react-hooks` and `globals`. It removes the Next-specific ESLint plugin chain and the old `eslint-plugin-jsx-a11y` package whose declared peer range caused npm to reject ESLint 10. Runtime accessibility coverage still includes the existing `@axe-core/playwright` browser tests. This is a deliberate lint-toolchain change and needs independent review of rule coverage; it should not be represented as identical coverage to the removed plugin.

The ESLint 10 candidate has passed the complete isolated workflow on the current PR head. However, the workflow was run for the pull-request event, so its publish job was skipped by design. The candidate manifest and lockfile are currently artifact output and must be applied to the isolated branch through the workflow's tested push/publish path. Then every required check must be reverified on the resulting new commit.

## Outstanding independent reviews

Review submissions queried on 2026-10-19 returned no reviews for PRs #62, #64 or #69. CI and self-authored evidence do not constitute independent approval.

Required before merge:
1. Independent security review of the full dependency manifest/lockfile diff, both audit reports, GitHub Actions permissions, pinned actions and candidate-publishing workflow.
2. Independent database/schema review of Prisma graph models, inverse relations, migration history, referential integrity and data-integrity checks, including PR #62's schema baseline and the integrated candidate.
3. Independent review of the ESLint 10 configuration/rule coverage and the removal/replacement of `eslint-plugin-jsx-a11y`.
4. Reconcile overlapping security workflow alternatives in PRs #63, #64, #66 and #67. Do not merge competing implementations independently.
5. Re-run and verify all mandatory checks on the final resulting commit, then verify mergeability, approvals and branch-protection requirements.

No independent reviewers are currently recorded. Request qualified reviewers who are not the author; do not self-approve or fabricate review results.

## Merge control

PR #69 remains open and draft, based on PR #62's schema branch. PR #62 and PR #64 also remain open drafts. Green CI is necessary but not sufficient. No merge, deployment, production migration, payment, filing or other external business action is authorized by this record.
