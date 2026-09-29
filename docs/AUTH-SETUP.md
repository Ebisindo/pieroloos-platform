# PieroloOS Authentication Setup

## Install

From the repository root:

```bash
npm install next-auth
```

## Copy files

Copy the following into the existing repository without deleting the existing `lib/auth` authorization primitives:

```text
lib/auth/auth.ts
lib/auth/session-bridge.ts
app/api/auth/[...nextauth]/route.ts
```

Merge `.env.auth.example` into `.env.example`.

## Generate Auth.js secret

In Codespaces:

```bash
openssl rand -base64 32
```

Store the resulting value as `AUTH_SECRET` in the Codespaces/deployment environment. Never commit it.

## GitHub OAuth

Create a GitHub OAuth App.

Local callback:

```text
http://localhost:3000/api/auth/callback/github
```

Production callback:

```text
https://YOUR-DOMAIN/api/auth/callback/github
```

Store the Client ID and Client Secret as:

```text
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
```

## Google OAuth

Create Google OAuth credentials.

Local callback:

```text
http://localhost:3000/api/auth/callback/google
```

Production callback:

```text
https://YOUR-DOMAIN/api/auth/callback/google
```

Store:

```text
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
```

## PieroloOS authorization boundary

The temporary session bridge does not invent organization/workspace membership.

Production flow:

```text
Auth.js user
  ↓
PieroloOS User
  ↓
Membership
  ↓
Organization
  ↓
Workspace
  ↓
Role / permissions
```

Resolve these values from the database before protected production workflows rely on them.

## Verify

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

Never paste OAuth secrets into chat or commit them to Git.
