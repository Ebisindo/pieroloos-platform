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