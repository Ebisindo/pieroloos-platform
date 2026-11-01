# Permanent Public Pre-Operation Preview

## Decision

The public pre-operation preview must be hosted as a continuously available staging deployment, not by keeping a GitHub Codespace open. Codespaces port forwarding is for development and is not an uptime guarantee; its forwarded address can stop working when a Codespace stops, is recreated, or its port mapping changes.

**Target:** a stable public HTTPS URL for PieroloOS preview, deployed from a dedicated preview branch through a managed hosting provider. Keep the Codespaces flow in [CODESPACES-PREVIEW.md](CODESPACES-PREVIEW.md) for developer-only testing.

## Hosting standard

Use an existing approved hosting provider if one has been configured and its access, build settings, and required services can be verified. If no provider is established, evaluate a managed Next.js host (for example Render or Vercel) against the app's actual requirements before choosing. Do not represent a provider as configured until a deployment is verified.

The chosen platform must support:
- Next.js production build and `npm run start` or its native Next.js integration.
- Node.js 22 or a compatible explicitly tested runtime.
- Secure environment variables and separate preview/staging settings.
- A stable HTTPS domain, health checks, deploy logs, and rollback.
- PostgreSQL connectivity and Prisma migrations under a deliberate release procedure.
- S3-compatible private object storage if the document workflow is enabled.
- Scheduled/worker routes if operational notifications are enabled.

## Environment isolation

Create a dedicated preview environment with:
- A separate PostgreSQL database (never production data).
- Non-production identity-provider application/callback settings.
- A distinct `NEXTAUTH_SECRET`.
- A separate private object-storage bucket and restricted credentials, where storage is enabled.
- Separate worker, document-scanner, and SMTP credentials; leave integrations disabled until configured and tested.
- Synthetic demo records only. No client production records, credentials, or documents.
- A reset/reseed procedure and accountable administrator.

Keep every secret in the hosting provider's secret manager. Never commit credentials into the repository, workflow files, documentation, or browser-exposed `NEXT_PUBLIC_*` variables.

## Required application configuration

Set these values in the preview host's environment, using actual values rather than placeholders:

| Variable | Requirement |
|---|---|
| `NODE_ENV` | Managed as production by the platform for a production-mode staging deployment |
| `NEXTAUTH_URL` | Exact stable HTTPS preview origin, no trailing slash |
| `NEXTAUTH_SECRET` | Unique random staging secret |
| `DATABASE_URL` | Dedicated staging PostgreSQL connection |
| `DATABASE_ENV` | Use the value supported by the repository's database config; verify before deployment |
| `SITE_URL` | Exact stable HTTPS preview origin, no trailing slash |
| `GITHUB_ID` / `GITHUB_SECRET` | Staging OAuth app credentials only, if GitHub login is enabled |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Non-production provider values only, if OIDC is enabled |
| `OBJECT_STORAGE_*` | Separate private preview bucket and credentials only if document storage is enabled |
| `OPERATIONAL_WORKER_SECRET`, `DOCUMENT_SCANNER_WEBHOOK_SECRET` | Separate high-entropy preview secrets only if those routes/integrations are enabled |
| `SMTP_*` | Non-production mail provider or safe sink only; don't send real customer notifications |

Register the actual callback URL for any staging OAuth app. For the GitHub provider this is `<PREVIEW_ORIGIN>/api/auth/callback/github`. Do not reuse the local Codespaces address as the permanent canonical origin.

## Release and database migration sequence

1. Run CI and inspect all checks before deploying.
2. Provision and verify the isolated staging database and required integrations.
3. Confirm the migration inventory and schema.
4. Apply migrations only to the preview database using the repository's documented deployment command and review the script before running it.
5. Deploy the selected commit/preview branch.
6. Check deployment logs and `/api/health`.
7. Smoke-test public routes `/` and `/partners`, legal content, sign-in/callbacks (if configured), application error states, and responsive/mobile layout.
8. Test only with synthetic records. Confirm there is no access to production tenants or production documents.
9. Record commit SHA, URL, environment configuration names (never values), test results, and rollback point.
10. Roll back the deployment if smoke tests fail. Database rollback requires its own migration/recovery plan; don't assume reverting application code reverses a schema change.

## Public-preview security

A publicly reachable preview is not a private staging environment. Until the launch-gate blockers are addressed, present it clearly as **PRE-OPERATION PREVIEW — NOT FOR REAL CLIENT DATA OR TRANSACTIONS**. Use demo-only seed content, disable real payments/production email, avoid exposing internal/admin controls to anonymous visitors, and never claim production readiness. Check [SESSION-27-PRODUCTION-READINESS-PILOT-GATE.md](SESSION-27-PRODUCTION-READINESS-PILOT-GATE.md) before any pilot or launch.

## Current status and acceptance criteria

Current hosting provider, domain, database, and environment secrets are not confirmed from repository access alone. Repository configuration changes cannot create a running external service or provision provider resources without account authorization and credentials.

Mark this work complete only when evidence confirms:
- Stable public HTTPS URL loads when no Codespace is running.
- The URL belongs to the chosen hosting deployment and is recorded in README.
- Automated preview deployment from the agreed branch works.
- Secrets and data resources are isolated from production.
- CI, health checks, smoke tests and responsive checks pass.
- Authentication callbacks are verified or authentication is deliberately disabled for the public preview.
- Rollback and operational ownership are documented.

Until these checks are performed, the `app.github.dev` URL remains a temporary Codespaces preview only.