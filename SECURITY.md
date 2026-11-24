# Security Policy

PieroloOS takes the security of its platform, customer information, business records, evidence, and supporting infrastructure seriously. This policy explains the security-update scope and the responsible-disclosure process for vulnerabilities affecting this repository and the PieroloOS application.

This policy is a security reporting document. It does not represent a certification, production security attestation, service-level commitment, or guarantee that every listed control is deployed or operational.

## Supported Versions

PieroloOS is currently in active development. Security fixes are prioritized for the latest maintained release and the current default branch.

| Version | Supported |
| ------- | --------- |
| Current `main` branch | :white_check_mark: |
| Latest published stable release, when available | :white_check_mark: |
| Older release branches | :x: unless explicitly listed here |
| Preview, experimental, or end-of-life builds | :x: |

A check mark means that security issues may be assessed and fixes may be issued for that line. It does not mean that the version is production-ready, actively monitored, or covered by a guaranteed response or patch deadline.

When a supported release is published, this table should be updated with its exact version range. Security fixes may require users to upgrade to a newer supported version.

## Reporting a Vulnerability

**Please do not report suspected security vulnerabilities through public GitHub issues, pull requests, discussions, commit messages, or social media.** Public disclosure can expose users and systems before a fix is available.

### Preferred reporting channel

Use GitHub's private vulnerability reporting facility for this repository:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability** (or **Advisories**, then **Report a vulnerability**, depending on the GitHub interface).
3. Submit the report privately with the information below.

Direct entry point: [Report a vulnerability privately](https://github.com/Ebisindo/pieroloos-platform/security/advisories/new).

If GitHub private vulnerability reporting is unavailable, do not publish exploit details publicly. Contact the repository owner through an established, trusted private channel and request a secure method for transmitting the report. Do not assume that a public issue or an ordinary email address is a secure disclosure channel.

### What to include

Provide enough detail for the maintainers to reproduce and assess the issue safely:

- A concise description and affected component, route, workflow, dependency, version, or commit.
- The security impact and realistic attack scenario.
- Reproduction steps or a minimal proof of concept.
- Relevant request/response examples, logs, or screenshots with secrets and personal data removed.
- Any known prerequisites, scope limitations, and potential mitigations.
- Your preferred contact method and whether you would like acknowledgement in a future security advisory.

Please do not include passwords, access tokens, private keys, session cookies, live credentials, unredacted customer records, identity documents, or other confidential information. Never test against another person's account, tenant, data, or production resources without explicit authorization.

### Response and remediation process

The maintainers will use the following targets as operational goals, not contractual service-level guarantees:

| Stage | Target |
| ----- | ------ |
| Initial acknowledgement | Within 3 business days |
| Initial triage and severity assessment | Within 7 business days after receiving sufficient information |
| Status update | At least every 10 business days while the report remains active |
| Remediation plan | Communicated after triage, with scope and dependencies identified |
| Public advisory or closure | After remediation, mitigation, or a documented decision not to proceed, coordinated with the reporter where practical |

Complex reports, incomplete reproduction details, third-party provider dependencies, holidays, and issues requiring coordinated disclosure may affect these targets. If a target cannot be met, maintainers should provide a status update when reasonably possible.

### Triage outcomes

After review, maintainers may:

- **Accept the report:** validate the finding, assign severity and ownership, track remediation privately, and prepare a fix or mitigation.
- **Request more information:** ask for clarification, a safer reproduction, or evidence needed to establish impact.
- **Decline the report:** explain the reason where possible. Examples include a non-security bug, duplicate report, unsupported version, out-of-scope finding, intended behavior, insufficient evidence, or a finding whose impact cannot be substantiated.
- **Redirect the report:** identify the appropriate upstream maintainer or service provider when the vulnerability is in a third-party dependency or external service.

An acknowledgement is not confirmation that a vulnerability is valid. A report being accepted for investigation is not a promise of a particular severity, patch date, bounty, or public recognition.

### Scope and areas of particular concern

Reports are especially relevant when they demonstrate a security impact involving:

- Authentication, session handling, account recovery, or identity-provider integration.
- Authorization, role or permission escalation, Platform Super Admin access, and organization/workspace or tenant isolation.
- Exposure, alteration, or deletion of business profiles, client records, engagement records, reports, evidence, uploaded documents, or private object storage.
- Document upload, download, scanning, storage access, integrity, or cross-tenant reference handling.
- Formation, jurisdiction, compliance, evidence, or advisory workflows that permit unauthorized changes, misleading provenance, or bypass of required human review.
- AI-assisted proposal handling, human approval boundaries, execution authorization, or unintended external actions.
- Payment configuration, payment webhooks, billing state, financial records, or replay/forgery of payment events.
- Worker endpoints, scheduled jobs, webhook authentication, rate limiting, secret handling, and background processing.
- CI/CD workflows, dependency supply chain, repository permissions, build artifacts, environment-file boundaries, agent sandboxing, and credential isolation.
- Injection, request forgery, insecure direct object references, unsafe file handling, and material data-integrity failures.

Security findings should be assessed against the actual deployed configuration and code path. A feature described in documentation or a planned architecture is not proof that it is deployed.

### Coordinated disclosure and researcher conduct

Please allow maintainers a reasonable opportunity to investigate and remediate before publishing details. Coordinate publication timing with the maintainers where practical, especially where users, customers, or upstream providers may be affected.

Researchers are expected to:

- Act in good faith and make reasonable efforts to avoid privacy violations, service disruption, data destruction, or access to information belonging to others.
- Test only accounts, systems, and data they own or are explicitly authorized to assess.
- Avoid denial-of-service testing, social engineering, physical attacks, spam, or destructive testing.
- Stop testing and report promptly if confidential data, credentials, or access to another tenant is encountered.
- Preserve relevant evidence without retaining or disclosing unnecessary personal or confidential information.

PieroloOS does not currently publish a bug-bounty or monetary reward program. No reward, waiver, or safe-harbor protection is promised by this policy. Applicable law and any separate written authorization remain controlling.

## Security and Privacy Boundaries

PieroloOS is a business intelligence, formation, compliance-workflow, and decision-support platform. It organizes information and supports human review; it does not replace qualified legal, tax, accounting, financial, or other regulated professionals, government authorities, or official registries.

Do not submit live secrets or customer data in public repository channels. Security incidents involving deployed services must be handled through the operator's approved incident-response process and restricted evidence channels. The repository's [Security Incident and Recovery Runbook](docs/SECURITY-INCIDENT-RECOVERY-RUNBOOK.md) is an operational checklist; its existence alone does not prove that production monitoring, alert delivery, backup, restoration, or response controls have been configured and tested.

## Policy Maintenance

This policy is maintained with the repository. Changes to the supported-version table, private reporting route, response targets, or disclosure expectations should be reviewed before publication.

Last reviewed: 24 November 2026.
