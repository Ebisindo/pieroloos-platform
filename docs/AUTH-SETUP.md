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
