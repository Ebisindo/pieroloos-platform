# PieroloOS Authentication Setup

PieroloOS uses NextAuth v4 with GitHub OAuth and an optional generic OIDC provider. The provider configuration and callbacks are defined in `lib/auth/auth-options.ts`.

## Configure environment

Copy the authentication values from `.env.auth.example` into `.env.local` or the Codespace/deployment environment. Set `NEXTAUTH_URL` to the application URL and `NEXTAUTH_SECRET` to a generated secret:

```bash
openssl rand -base64 32
```

Never commit secret values.

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

Sign-in is allowed only for users already present in the database with an organization membership. `PLATFORM_SUPERADMIN_EMAILS` is a comma-separated list of platform superadmin email addresses; it does not bypass the membership requirement. Protected workflows should resolve organization, workspace, and role permissions from the database.

## Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
