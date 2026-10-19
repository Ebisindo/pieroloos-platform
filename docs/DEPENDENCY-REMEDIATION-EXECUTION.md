# Dependency remediation execution gates

This isolated branch runs Node.js 22 candidate validation at `.github/workflows/dependency-remediation-candidate.yml`.

## Candidate requirements

- Generate `package.json` and `package-lock.json` with npm on the hosted Node.js 22 runner; never hand-edit the lockfile.
- Pin direct dependencies rather than declaring `latest`.
- Keep Next.js on the security-fixed Next 16 patch and remove the vulnerable `eslint-config-next` / `@next/eslint-plugin-next` dependency chain from this candidate.
- Use a maintained independent TypeScript/React/hooks/accessibility ESLint stack; retain current repository lint-debt diagnostics as warnings pending dedicated cleanup.
- Treat the `deepmerge-ts` 8.x override as an isolated compatibility experiment that must pass Prisma validation, migration/integrity tests, lint, typecheck, unit tests, production build and Playwright.
- Capture full and production-only `npm audit --json` evidence.
- Reject publication if either full or production-only audit has high/critical findings, if any direct dependency remains `latest`, or if the lockfile does not match the manifest.
- Do not use `npm audit fix --force` or manually edit the lockfile.

The workflow may publish candidate package files only to this isolated branch after all candidate checks pass. This does not authorize merge, deployment or production migration. Independent security and database/schema reviews remain required.

## Results — 19 October 2026

### Candidate and exact-head validation

- Tested dependency candidate commit: `a1e6cd7b6e4e76becf45dc4fd7659d2437e40b10`.
- Current PR head: `e97c8a413cccf9235ba4c5648ae2e9a879e67c01`.
- Candidate-validation PR run: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39256479364
- Candidate-validation push run: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39256469548
- Standard CI PR run: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39256479838
- Standard CI push run: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39256469587
- Security checks: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39256479256
- Dependency diagnostics: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39256479272
- Latest candidate artifact: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39256479364/artifacts/12188110809

### Tested dependency result

- Next.js: `16.4.2`.
- `eslint-config-next` and `@next/eslint-plugin-next`: removed from the generated lockfile.
- Replaced Next-specific lint integration with `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` and `globals`.
- Prisma and `@prisma/client`: `6.19.3`.
- `deepmerge-ts`: `8.0.0` override.
- All direct dependencies are pinned; no direct `latest` declarations remain.
- Candidate full and production-only audits: 0 vulnerabilities each (0 info, low, moderate, high or critical).
- Candidate validation passed reproducible `npm ci`, PostgreSQL schema/migration and integrity checks, lint, typecheck, unit tests (448 passed, 10 skipped), production build and Playwright (32 passed).
- Lint has 24 existing-source warnings and no lint errors.
- npm reported that ESLint `9.39.5` is no longer supported. This remains a dependency-maintenance follow-up: select a supported ESLint version and rerun all gates without hiding lint debt.

## Pull-request creation and review policy

- Do not create a duplicate PR for the same source/target branch pair.
- PR #69 is the canonical remediation proposal for `security/npm-dependency-remediation-diagnostics` → `fix/main-prisma-graph-schema-clean-repair`.
- PR #62 supplies the schema baseline.
- PRs #63, #64, #66 and #67 overlap on CI/security workflow files. Reconcile their unique required fixes into one clear final path; do not merge overlapping alternatives independently.
- Automated green checks do not replace an independent human review. The current head has no submitted reviews yet; request review from a collaborator or team other than the author.
- Before marking PR #69 ready: complete the full diff/audit artifact review, address the ESLint support concern, obtain independent security and database/schema review, then rerun CI/security on the final head.
- Merge only with explicit authorization after current checks and approvals satisfy repository policy.

## Safety boundary

PR #69 remains draft and unmerged. No production deployment, production migration, external filing or payment action was performed or authorized.

Related: #62 #63 #64 #65 #66 #67