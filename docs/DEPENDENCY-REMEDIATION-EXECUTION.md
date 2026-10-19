# Dependency remediation execution gates

This isolated branch runs Node.js 22 candidate validation at `.github/workflows/dependency-remediation-candidate.yml`.

## Candidate requirements

- Generate `package.json` and `package-lock.json` with npm on the hosted Node.js 22 runner; never hand-edit the lockfile.
- Pin direct dependencies rather than declaring `latest`.
- Keep Next.js on the security-fixed Next 16 patch and remove the vulnerable `eslint-config-next` / `@next/eslint-plugin-next` dependency chain from this candidate.
- Use a maintained independent TypeScript/React/hooks/accessibility ESLint stack; retain the current repository lint-debt diagnostics as warnings pending dedicated cleanup.
- Treat the `deepmerge-ts` 8.x override as an experiment that must pass Prisma validation, migration/integrity tests, lint, typecheck, unit tests, production build and Playwright.
- Capture full and production-only `npm audit --json` evidence.
- Reject publication if either full or production-only audit has high/critical findings, if any direct dependency remains `latest`, or if the lockfile does not match the manifest.
- Do not use `npm audit fix --force` or manually edit the lockfile.

The workflow can publish dependency candidate files only to this isolated branch after the tested candidate checks pass. This does not authorize merge, deployment, or production migration. Independent security and database/schema reviews remain required.

## Results — 19 October 2026

### Published candidate

- Candidate dependency commit: `a1e6cd7b6e4e76becf45dc4fd7659d2437e40b10`
- Latest follow-up workflow/config commit: `f86bbe65525219d6c5813b2e1727eef987d74984`
- Candidate validation and branch publication: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39255660975
- Candidate evidence artifact (30-day retention): https://github.com/Ebisindo/pieroloos-platform/actions/runs/39255660975/artifacts/12187433623

### Tested dependency result

- Next.js: `16.4.2`.
- `eslint-config-next` and `@next/eslint-plugin-next`: removed from the generated lockfile.
- Replaced the Next-specific lint chain with pinned `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, and `globals`.
- Prisma and `@prisma/client`: `6.19.3`.
- `deepmerge-ts`: `8.0.0` override.
- All direct dependencies no longer declare `latest`.
- Candidate full audit: zero vulnerabilities reported (0 info, 0 low, 0 moderate, 0 high, 0 critical).
- Candidate production-only audit: zero vulnerabilities reported (0 info, 0 low, 0 moderate, 0 high, 0 critical).
- Candidate passed reproducible `npm ci`, PostgreSQL migration/schema and data-integrity checks, lint, typecheck, unit tests (448 passed, 10 skipped), production build, and Playwright (32 passed). Lint emits 24 warnings for existing unused imports/variables, explicit `any`, empty-object-type, and accessibility-label issues; it produced no lint errors.
- Push CI run at the pre-publication source head passed quality/database checks and E2E: https://github.com/Ebisindo/pieroloos-platform/actions/runs/39255660623

### Remaining validation gate

The candidate publisher committed the tested package files with the GitHub Actions identity. GitHub subsequently returned `action_required` for its normal pull-request CI/security workflows at the bot-authored commit `a1e6cd7b6e4e76becf45dc4fd7659d2437e40b10`, with no jobs executed. Therefore, **the candidate workflow's successful test suite is evidence for the generated candidate, but fresh standard CI/security checks on the published exact commit still need to run**.

Before promotion, verify the exact published commit with standard CI, CodeQL, Gitleaks, and the regular repository `npm audit --audit-level=high` job; record independent security review; and separately resolve the known schema/migration-history drift in the schema track. PR #69 remains draft/unmerged. No deployment or production migration has been performed.
