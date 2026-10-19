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

### Current pull request and branch comparison

- Canonical PR: https://github.com/Ebisindo/pieroloos-platform/pull/69
- Source: `security/npm-dependency-remediation-diagnostics`.
- Target: `fix/main-prisma-graph-schema-clean-repair`.
- Current PR head: `2326dc3f0e98a9950b7942d6757e76865682fa05`.
- Branch comparison: 21 commits ahead, 0 behind; 8 changed files.
- Do not create a duplicate PR for this same source/target pair.
- PR #69 remains draft and unmerged; no independent reviews have been submitted.

### Tested dependency result

- Next.js: `16.4.2`.
- `eslint-config-next` and `@next/eslint-plugin-next`: removed from the generated lockfile.
- Replaced Next-specific lint integration with `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` and `globals`.
- Prisma and `@prisma/client`: `6.19.3`.
- `deepmerge-ts`: `8.0.0` override.
- All direct dependencies are pinned; no direct `latest` declarations remain.
- Candidate full and production-only audits reported 0 vulnerabilities each (0 info, low, moderate, high or critical).
- Candidate validation passed reproducible `npm ci`, PostgreSQL schema/migration and integrity checks, lint, typecheck, unit tests (448 passed, 10 skipped), production build and Playwright (32 passed).
- Lint has 24 existing-source warnings and no lint errors.
- npm reported that ESLint `9.39.5` is no longer supported. This remains an explicit dependency-maintenance follow-up: select a supported ESLint version and rerun all gates without hiding lint debt.

### Latest exact-head automation evidence

All runs below correspond to current head `2326dc3f0e98a9950b7942d6757e76865682fa05`:

- Candidate validation on push: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39260087191 — passed; generated candidate passed checks and was applied to the isolated branch.
- Candidate validation on PR: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39260093829 — passed; publication step skipped on PR event as designed.
- Standard CI on push: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39260087087 — passed.
- Standard CI on PR: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39260093811 — passed.
- Security checks (audit, Gitleaks, CodeQL): https://github.com/Ebisindo/pieroloos-platform/actions/runs/39260093783 — passed.
- Dependency diagnostics: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39260094104 — passed.

### PR overlap and review policy

- PR #62 supplies the schema baseline.
- PRs #63, #64, #66 and #67 overlap on CI/security workflow files. Reconcile their unique required fixes into one clear final path; do not merge overlapping alternatives independently.
- Automated green checks do not replace independent human review. The current PR has no submitted reviews; request a reviewer who is not the author.
- Before marking PR #69 ready: review the full diff and audit artifact, address the ESLint support concern, obtain independent security and database/schema review, then rerun CI/security on the final head.
- Merge only with explicit authorization after current checks and approvals satisfy repository policy.

## Safety boundary

PR #69 remains draft and unmerged. No production deployment, production migration, external filing or payment action was performed or authorized.

Related: #62 #63 #64 #65 #66 #67
