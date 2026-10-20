# GitHub Branch, Pull Request, Review, and Merge Workflow

## Purpose

Use this workflow for PieroloOS changes so code is proposed, compared, tested, reviewed, and merged in a traceable manner. A pull request (PR) is a review and integration mechanism; it is not proof that a feature works and it is not permission to deploy production or change production data.

## The three mechanisms

| Mechanism | What it does | What it does not prove |
| --- | --- | --- |
| Compare branches/commits | Shows differences between a base and proposed head: commits ahead/behind and changed files. Use it before opening or updating a PR. | It does not test, review, merge, or deploy the changes. |
| Create a pull request | Opens a reviewable proposal from a head branch into a base branch (normally `main`). A draft PR communicates that work is still in progress. | Opening a PR does not mean it is ready, approved, safe, or merged. |
| Merge a pull request | Integrates the reviewed head into the base using an allowed strategy: merge commit, squash, or rebase. | Mergeability alone is not a quality/security verdict. A merge does not authorize production deployment or database migration. |

## Recommended lifecycle

1. **Start from the latest base.** Create a dedicated branch for one coherent change. Avoid mixing unrelated features, migrations, refactors, and policy changes in one PR.
2. **Make and test the change locally or in Codespaces.** Run relevant checks and inspect the working tree. Never commit credentials, production data, `.env` secrets, or generated sensitive files.
3. **Compare before creating the PR.** Compare the feature branch with the intended base, usually `main`. Investigate unexpected files, unrelated commits, schema drift, and migration-order changes. Check whether the branch is behind or diverged, not merely ahead.
4. **Create a draft PR when work is incomplete.** State the problem, approach, risk, tests run and results, migration/rollback implications, known gaps, and linked issues. Use draft status while blocking validation or review remains outstanding.
5. **Keep the PR current and inspect the exact head.** When the base advances, update/rebase/merge the base into the feature branch according to project policy, resolve conflicts deliberately, and rerun required checks. Review the diff again. CI evidence must refer to the current head SHA, not an earlier commit or another branch.
6. **Review independently.** Review correctness, authorization and tenant boundaries, data integrity, error handling, security, migration compatibility, logging/auditing, tests, and scope. Address blocking comments; resolve threads only when the issue is fixed.
7. **Mark ready only after the gates pass.** The PR should be non-draft, have required approvals, no unresolved blocking review, and green required CI checks on the latest head. Verify that the merge base remains correct.
8. **Merge deliberately.** Follow repository policy and required checks. Squash is often convenient for a focused feature; merge commits preserve branch history; rebase creates a linear history. Use an allowed method consistent with team convention. Enable auto-merge only when the required checks/reviews are configured and the PR is eligible.
9. **Verify after merge.** Record the resulting merge commit, check CI on the integrated base branch, and perform staging/post-merge verification. A green PR run can differ from the base-branch post-merge result.
10. **Release separately.** Production deployment and database migration require their own explicit authorization, verified migration and recovery/backup plans, environment-specific checks, and a documented rollback/forward-fix strategy.

## Decision gates

**Create PR** when a coherent change exists and needs review—even when it is still draft.

**Mark ready** only when the author considers it complete and required validation is demonstrably passing.

**Merge** only when required review and checks pass for the exact head, conflicts are understood, schema/migration effects are reviewed, and acceptance criteria are met.

**Do not merge** when required checks fail or are absent, the PR is draft, security or tenant-isolation concerns remain, migration history is unresolved, the branch has unreviewed divergence, or the only evidence is that GitHub labels it mergeable.

**Do not deploy** merely because the PR was merged. Treat deployment as a separate release decision.

## Practical Git commands

Replace `<branch>` with the actual feature branch name.

```bash
git fetch origin
git log --oneline --graph --decorate origin/main..<branch>
git diff --stat origin/main...<branch>
git diff --check origin/main...<branch>
git diff --name-status origin/main...<branch>

npm run lint
npm run typecheck
npm test
npm run db:validate
npm run db:inventory
npm run build
# Run npm run test:db when PostgreSQL test infrastructure is available.
```

These are examples; follow current package scripts and CI workflows. Never run a migration command against production as part of ordinary PR validation.

## GitHub UI sequence

1. **Compare:** open *Pull requests → New pull request*, select base (normally `main`) and head branch, then inspect ahead/behind information and changed files.
2. **Create:** enter a precise title and body with summary, risks, tests, migration impact, screenshots if relevant, and linked issues. Select **Create draft pull request** if not ready for review.
3. **Review:** inspect **Files changed**, **Commits**, **Checks**, review threads, and conflict information. Make corrections on the same branch; the PR updates automatically.
4. **Merge:** only after approvals and required checks pass, select a repository-approved merge method. If the button is unavailable or checks fail, resolve the gate rather than bypassing it.
5. **Verify:** inspect the merged commit and base-branch CI; document failures as release blockers.

## Current PieroloOS control note — 19 October 2026

This is a snapshot of known integration concerns, not a declaration that they are resolved:

- PR #41 was merged, but post-merge workflow run [#39173478347](https://github.com/Ebisindo/pieroloos-platform/actions/runs/39173478347) failed. The release-gate record identifies a Prisma schema/client mismatch for corporate-graph models/enums and a migration/integrity cleanup failure.
- PR #39 remains a draft integration candidate. Its branch is ahead of `main` and also behind/diverged by one commit; it needs deliberate comparison/reconciliation and full validation, not a blind merge.
- PR #40 has a successful isolated CI run recorded for its own head, but isolated success does not resolve broader canonical-registry, graph-schema, and evidence-tenant-isolation blockers.
- Release gate #32 remains open. Keep it open until required issues and acceptance criteria have evidence of completion.
- Do not merge another integration solely because of a green run from another branch. Do not make production database or deployment changes without separate approval.

Use live GitHub pull-request pages and Issue #32 as the source of truth; refresh this snapshot when underlying state changes.
