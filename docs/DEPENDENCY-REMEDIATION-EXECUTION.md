# Dependency remediation execution gates

This isolated branch runs the Node.js 22 candidate workflow at `.github/workflows/dependency-remediation-candidate.yml`.

## Candidate requirements

- Generate `package.json` and `package-lock.json` using npm in the hosted Node.js 22 runner; never hand-edit the lockfile.
- Pin direct dependencies rather than declaring `latest`.
- Keep Next.js and `eslint-config-next` on the same security-fixed Next 16 patch.
- Treat the `deepmerge-ts` 8.x override as an experiment that must pass Prisma validation, migration/integrity tests, lint, typecheck, unit tests, production build and Playwright.
- Capture full and production-only `npm audit --json` evidence.
- Reject the candidate if the production audit has high/critical findings, if any direct dependency remains `latest`, or if the lockfile does not match the manifest.
- The known `braces`/ESLint tooling-chain advisory is not considered remediated merely because the production-only audit is clean. The full audit must remain visible and release-blocking until fixed or explicitly accepted by the authorized security owner with a time-bound exception.

The workflow may publish candidate manifest/lockfile files only to this isolated branch after its checks pass. This is not authorization to merge PR #62 or #64, deploy, or apply production migrations. Independent security and database/schema reviews remain required.

## Candidate result — 19 October 2026

The Node.js 22 candidate workflow successfully generated and validated the dependency candidate and published its manifest and lockfile to the isolated branch.

- Candidate commit: `0b22ffa28883f34e1ef3d38056b0a6fdca475dfa`
- Candidate workflow (push): https://github.com/Ebisindo/pieroloos-platform/actions/runs/39253434466
- Candidate artifact evidence (30-day retention): https://github.com/Ebisindo/pieroloos-platform/actions/runs/39253434466/artifacts/12187265312
- Direct dependency declarations formerly set to `latest` are now pinned to concrete versions.
- Next.js and `eslint-config-next` are both `16.4.2`; Prisma and `@prisma/client` remain `6.19.3`; `deepmerge-ts` is overridden to `8.0.0`.
- The candidate workflow passed locked-install reproducibility, full and production-only audit evidence capture, PostgreSQL migration/schema checks and data integrity, lint, typecheck, unit tests, production build, and Playwright.
- The candidate's production-only audit had no high/critical findings. The full audit still reports five high-severity findings in the known `braces` / `micromatch` / `fast-glob` / Next ESLint tooling chain. That is **not** a clean full audit and remains a release blocker until the vulnerable path is removed or the authorized security owner explicitly approves a time-limited exception with mitigation.

The dependency commit was created by the candidate workflow token, so its initial PR-triggered checks returned `action_required` without jobs. A subsequent user-authored documentation commit is being used to trigger normal exact-head CI/security checks. This does not waive any gate. Independent review is still absent. PR #69 remains draft/unmerged; do not deploy or apply production migrations.
