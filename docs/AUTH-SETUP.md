# PieroloOS Authentication Setup

PieroloOS uses NextAuth v4 with GitHub OAuth, an optional generic OIDC provider, and an opt-in local-development credentials provider. The provider configuration and callbacks are defined in `lib/auth/auth-options.ts`.

## Diagnosing "Identity provider not configured"

The `/signin` page shows this when `authConfigured` (see `lib/auth/auth-options.ts`) is false: either `NEXTAUTH_SECRET` is unset or no supported identity provider is configured in the running server's environment. The missing variable names are logged server-side (never values, never shown to visitors). `/api/auth/*` returns a generic 503 until configured; public pages are unaffected. There is no fallback secret.

## Configure environment

Copy the authentication values from `.env.auth.example` into `.env.local` or the Codespace/deployment environment. Set `NEXTAUTH_URL` to the application URL and `NEXTAUTH_SECRET` to a generated secret:

```bash
openssl rand -base64 32
```

Never commit secret values.

## Local development sign-in

When running `npm run dev`, local sign-in can use one already-provisioned staff account without an external OAuth provider. Set `LOCAL_AUTH_ENABLED=true`, `LOCAL_AUTH_EMAIL` to the account's email, and `LOCAL_AUTH_PASSWORD` to a development-only password in the ignored `.env` or `.env.local` file. `NEXTAUTH_SECRET` is still required; generate it with the command above. Restart the server after changing these values.

```dotenv
LOCAL_AUTH_ENABLED="true"
LOCAL_AUTH_EMAIL="staff@example.com"
LOCAL_AUTH_PASSWORD="use-a-unique-local-development-password"
```

Local credentials are registered only when `NODE_ENV=development` and the opt-in flag and both credential values are present. The normal sign-in authorization callback still checks that the email belongs to an existing user with an organization membership. This provider is unavailable in production regardless of its environment values, and does not authorize client-portal-only accounts. Do not reuse a real account password.

## GitHub OAuth

Create a GitHub OAuth App and configure its callback URL:

```text
http://localhost:3000/api/auth/callback/github
```

For deployment, replace the host with the application domain. Set the OAuth app's client ID and secret as `GITHUB_ID` and `GITHUB_SECRET`.

## Organization OIDC

Set `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` for the organization's identity provider. The callback URL uses the provider id `oidc`:

```text
http://localhost:3000/api/auth/callback/oidc
```

`OIDC_PROVIDER_NAME` controls the provider label shown on the sign-in page.

## Authorization

Sign-in is allowed only for users already present in the database with an organization membership (or an active, verified client portal grant). Platform-wide administrator status is stored in the database and does not bypass the staff membership requirement. It is resolved from the current database assignment for each server-side authorization check, not from the session JWT. See [ADMINISTRATION.md](ADMINISTRATION.md) for initial provisioning, permission delegation, and recovery.

`GET /api/partnerships/inquiries` requires a signed-in administrator with `partnership-inquiries.read` (401 or 403 otherwise). `POST` on the same path is public and protected by origin checks, rate limits and validation. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full boundary list.

## Variables

| Variable | Purpose |
| --- | --- |
| `NEXTAUTH_URL` | Public origin of the site, e.g. `https://YOUR-DOMAIN`; used for callbacks and secure cookies (https enables `__Secure-` cookies). |
| `NEXTAUTH_SECRET` | Signs/encrypts session JWTs. Required; generate with `openssl rand -base64 32`. |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth App client ID and secret. |
| `OIDC_*` | Optional organization SSO. |
| `LOCAL_AUTH_ENABLED`, `LOCAL_AUTH_EMAIL`, `LOCAL_AUTH_PASSWORD` | Optional development-only sign-in for an existing staff account; ignored outside `NODE_ENV=development`. |

## GitHub OAuth App steps

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App (or open the existing one).
2. Homepage URL: `https://YOUR-DOMAIN`.
3. Authorization callback URL: `https://YOUR-DOMAIN/api/auth/callback/github` (use a separate app with `http://localhost:3000/...` for development).
4. Copy the Client ID; choose "Generate a new client secret" and copy it once.
5. Set `GITHUB_ID`, `GITHUB_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` in the hosting platform's runtime environment settings (the repository does not define a hosting platform; GitHub repository/Actions secrets are NOT visible to the running site). Locally use `.env.local` (git-ignored).
6. Restart the server (`npm run dev`) or redeploy; environment variables are read at process start.
7. Verify: `/signin` shows the GitHub button, sign-in returns to `/command-center`, and `/api/auth/signout` ends the session.

Sign-in additionally requires an existing user with an organization membership or active client-portal grant; nobody is made administrator automatically.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Privileged-operation step-up contract (Successor & Business Continuity)

**Current state:** the standard NextAuth session contains identity but does not expose a validated, recent authentication/MFA assertion. GitHub OAuth sign-in and OIDC `email_verified` are not sufficient evidence of MFA. Therefore successor/continuity POST and PATCH mutations must remain fail-closed (HTTP 503) until the checks below are implemented and independently verified.

### Required provider contract

Before implementing an adapter, the identity-provider owner must supply redacted documentation and a staging client configuration that establishes all of the following:

1. **Provider binding:** one explicitly configured OIDC issuer and audience/client ID, using the OIDC discovery metadata/JWKS for signature verification. Do not trust issuer, audience, JWKS URL, or signing algorithm supplied by a request.
2. **Fresh challenge:** an interactive reauthentication/step-up request with a cryptographically random, single-use state/nonce bound to the signed-in server-side user and the intended operation. A valid general login session by itself is not step-up.
3. **Authentication recency:** validated `auth_time` no older than the configured short step-up window (default policy proposal: 5 minutes), with bounded clock skew. Require the provider-documented MFA assurance signal (for example `acr` / `amr` values only if documented and validated by the selected provider). Do not equate `email_verified`, a successful callback, an OAuth access token, a user-controlled claim, or an environment flag with MFA.
4. **Identity binding:** validated `iss`, `aud`, `sub`, `iat`, `exp`, `nonce`, authentication time and required MFA assurance. Map `(issuer, subject)` to the local account through a trusted server-side account binding; never bind by a mutable email alone.
5. **Replay resistance:** store a digest of the step-up transaction identifier/nonce server-side and atomically consume it once. Reject replay, expired state, wrong user, wrong operation, wrong issuer/audience, reused nonce and stale authentication. Keep the raw ID token and access token out of audit logs.
6. **Per-request authorization:** the mutation request must carry an opaque, short-lived step-up handle or be bound to a server-managed one-time challenge. On each POST/PATCH, verify the handle against the active server-side session, subject, operation scope, expiry and unconsumed state, then consume it in the same transaction as the domain mutation/audit write. CSRF/origin, rate limits, current SuperAdmin database assignment and tenant/resource scope remain separately required.
7. **Failure behavior:** provider outage, missing/malformed claim, unsupported assurance value, session mismatch, clock uncertainty, persistence failure, or failed audit write denies the mutation. No permissive fallback is allowed.

This is an interface/acceptance contract, not a claim that any currently configured provider meets it. Exact `acr`/`amr` values and provider endpoint behavior must be supplied and reviewed before implementing the provider-specific adapter.

### Required negative and integration tests

Test valid fresh MFA; missing MFA; email-verified-only identity; unsupported `acr`/`amr`; forged signature; wrong issuer/audience/subject; stale `auth_time`; expired token/state; wrong nonce/state; state replay; reusing a step-up handle; using a handle for a different action; switching accounts between challenge and mutation; cross-tenant resource IDs; revoked SuperAdmin assignment; CSRF/origin rejection; provider timeout; transaction/audit failure; and concurrent claims. For every denial, assert that no successor, role, notification, provider, billing, secret or audit-success side effect occurs. Verify permitted denials are audited without recording tokens or sensitive payloads.

### Controlled staging proof

Use a dedicated staging OIDC client, disposable staff accounts, non-production assets and redacted claims. Capture the provider name/version, issuer and audience identifiers (not secrets), claim names and assurance semantics, test commit SHA, workflow URLs, sanitized expected/actual statuses, audit event identifiers, and reviewer decisions. Keep secret values out of GitHub comments/artifacts. Test SMTP invite delivery, expiry/replay, warning cancellation, worker-secret rejection, retry/dead-letter paths, and recovery runbook rollback separately from authentication tests.

### Release gate

The feature remains disabled for sensitive writes until (a) the identity-provider owner supplies the contract, (b) the adapter and negative tests pass on an exact SHA, (c) independent security/identity and database reviewers approve that SHA, and (d) staging evidence is recorded. No automatic promotion, legal ownership transfer or GitHub/Vercel/domain/secret/billing transfer may be triggered by inactivity.

