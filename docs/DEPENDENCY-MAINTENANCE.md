# Dependency maintenance and security response

## Operating model

Automated dependency-update pull requests are intentionally not part of this process. Repository maintainers own dependency health; the weekly GitHub Actions security workflow supplies evidence, not automatic remediation. A maintainer should review the latest run and its artifacts at least weekly, and after any dependency-manifest or lockfile change.

## Controls and evidence

- **Known npm vulnerabilities:** run `npm audit --audit-level=high` and `npm audit --omit=dev --audit-level=high`. The scheduled security workflow runs both against the locked dependency tree.
- **Lockfile integrity:** `npm ci` must complete without changing or regenerating the lockfile. `node scripts/check-dependency-controls.mjs` verifies lockfile v3 and exact agreement between manifest dependency declarations and lockfile root metadata.
- **Dependency-change CI:** pull requests changing `package.json`, `package-lock.json`, this control script, or GitHub workflow files run the dependency controls. The normal CI suite remains in force.
- **Scheduled maintenance:** every weekly security run records `npm outdated --json` output as an artifact. Outdated packages are review signals, not instructions to upgrade blindly.
- **GitHub Actions pinning:** the control script rejects external Actions not pinned to a full 40-character commit SHA and container actions not pinned by SHA-256 digest. Keep a human-readable version comment beside each SHA and review upstream releases/advisories during maintenance.
- **Human remediation:** maintainers assess exploitability, reachability, release notes, peer compatibility, migrations, and rollback risk; propose the smallest compatible update; regenerate the lockfile with the approved Node/npm toolchain; and submit one reviewed pull request with evidence.

## Triage and service targets

1. **Critical or actively exploited:** acknowledge promptly, assign a maintainer immediately, assess exposure, and ship a tested mitigation as soon as safely possible.
2. **High:** assign an owner and target remediation within seven calendar days unless a documented risk decision explains the exception.
3. **Moderate/low and outdated packages:** review during the weekly maintenance pass and prioritize based on reachability, support status, and upgrade risk.
4. Record the affected package, advisory URL or identifier, severity, affected code paths, chosen fix or mitigation, test results, reviewer, and follow-up date in a GitHub issue or pull request. Do not close a finding solely because a workflow file exists or a job was started.
5. If no safe compatible fix is available, document the exposure, compensating controls, accountable maintainer, and next review date. Reassess on each scheduled review.

## Required review evidence

For each weekly run, the reviewer records the workflow-run URL and whether the following were inspected: lockfile/manifest check, npm audit results (including production-only results), outdated-package artifact, Actions SHA-pinning check, and any open remediation items. Failed checks require a tracked issue or a documented incident response. A green run proves only the checks that actually executed; it does not replace review of findings or repository-level security settings.
