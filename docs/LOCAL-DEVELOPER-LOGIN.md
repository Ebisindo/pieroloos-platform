# Local developer sign-in

This setup is for a local development process only. It does not create an account, organization membership, administrator, or Super Administrator assignment.

## 1. Set local environment

From the repository root, create or edit the ignored `.env.local` file. Do not commit it or paste its values into GitHub.

```dotenv
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="REPLACE_WITH_A_NEW_RANDOM_SECRET"
LOCAL_AUTH_ENABLED="true"
LOCAL_AUTH_EMAIL="pierolocorpinternational@gmail.com"
LOCAL_AUTH_PASSWORD="SET_THE_DEVELOPMENT_PASSWORD_LOCALLY"
```

Generate a strong NextAuth secret:

```bash
openssl rand -base64 32
```

Enter the development password directly into your local `.env.local` editor or terminal prompt. Never place it in source code, shell history, screenshots, commit messages, GitHub issues, or CI logs. Do not reuse a production account password.

## 2. Start/restart Next.js

```bash
npm run dev
```

Changing environment variables requires restarting the development server. Open the local port 3000 preview and use the exact email/password values from `.env.local`.

## 3. Confirm the user is provisioned

The credentials provider intentionally authenticates only an existing user with an organization membership. It does not create users or grant privileges. If sign-in is rejected, an authorized administrator must provision the staff identity and membership through the platform's controlled onboarding process; do not bypass the guard.

Super Administrator is a separate database assignment. A successful local login does not imply Super Administrator status. Use the reviewed, audited provisioning procedure only after verifying the intended identity and existing membership.

## 4. Scope and security

- The credentials provider is registered only when `NODE_ENV=development` and `LOCAL_AUTH_ENABLED=true`.
- Production must use a supported organization identity provider; local credentials are never a production fallback.
- Keep `.env.local` out of Git. The repository ignores `.env.local` and `.env`.
- If the password was exposed in a screenshot, issue, chat, commit, terminal recording, or other shared location, rotate it immediately.
- Use a separate, unique local password. Do not use it for email, GitHub, hosting, or production services.
- This mechanism is intended for the development server bound to the local Codespace forwarded port. Do not publish these local credentials as a shared team login.
