# Local developer sign-in

This setup is for a local development process only. It does not create an account, organization membership, administrator, or Super Administrator assignment.

## 1. Set local environment

Create or edit the ignored `.env.local` file from the repository root. Do not commit it or paste its values into GitHub.

For a browser opened through the GitHub Codespaces forwarded port, set `NEXTAUTH_URL` to the exact HTTPS forwarded address shown for port 3000 (the Ports panel → Open in Browser). Do not use the Codespace's internal hostname. Use `http://localhost:3000` only when the browser itself is accessing the application through localhost.

```dotenv
NEXTAUTH_URL="https://YOUR-EXACT-CODESPACE-PORT-3000-FORWARDED-ADDRESS"
NEXTAUTH_SECRET="REPLACE_WITH_A_NEW_RANDOM_SECRET"
LOCAL_AUTH_ENABLED="true"
LOCAL_AUTH_EMAIL="pierolocorpinternational@gmail.com"
LOCAL_AUTH_PASSWORD="SET_THE_DEVELOPMENT_PASSWORD_LOCALLY"
```

Generate a fresh NextAuth secret:

```bash
openssl rand -base64 32
```

Enter a new, unique development password directly into `.env.local`. Do not reuse a password exposed in a screenshot, chat, issue, terminal recording, or commit. Never place credentials in source code, shell history, screenshots, GitHub issues, or CI logs.

## 2. Verify the local environment safely

```bash
grep -q '^LOCAL_AUTH_ENABLED="true"$' .env.local && echo "Local auth enabled"
grep -q '^LOCAL_AUTH_EMAIL="pierolocorpinternational@gmail.com"$' .env.local && echo "Developer email configured"
grep -q '^LOCAL_AUTH_PASSWORD=".' .env.local && echo "Local password configured (value hidden)"
grep -q '^NEXTAUTH_SECRET=".' .env.local && echo "NextAuth secret configured (value hidden)"
```

Do not use `cat .env.local`, `printenv`, `env`, or shell tracing to display the secret values.

## 3. Restart Next.js

Stop the existing server with Ctrl+C, then run:

```bash
npm run dev
```

Open the forwarded HTTPS port 3000 address and sign in using the values stored in `.env.local`. If the server reports an authentication configuration problem, inspect the server error without printing environment values.

## 4. Confirm staff provisioning

The credentials provider authenticates only an existing database user with an organization membership. It does not create users or grant privileges. If access is denied, check the exact email and the existing staff membership using the controlled administrative procedure. Do not weaken or bypass the membership check.

Super Administrator is a separate database assignment. A successful local sign-in does not imply Super Administrator status.

## 5. Scope and security

- Local credentials are registered only when `NODE_ENV=development` and `LOCAL_AUTH_ENABLED=true`.
- Production must use a supported organization identity provider; local credentials are never a production fallback.
- `.env.local` and `.env` are ignored by Git. Confirm this before entering secrets: `git check-ignore -v .env.local`.
- Use a fresh unique password and fresh NextAuth secret; rotate any values exposed previously.
- Do not share local credentials with other developers. Each developer should have an individually provisioned account.
