# GitHub Codespaces Preview Runbook

This runbook starts the PieroloOS Next.js development server, forwards port 3000, and opens the HTTPS preview. It does not deploy the application or change production infrastructure.

## 1. Open the correct Codespace

Open the `Ebisindo/pieroloos-platform` repository in the Codespace you want to use. In the integrated terminal, run:

```bash
pwd
ls -la
node --version
npm --version
```

Run commands from the repository root (the directory containing `package.json`). The project currently targets Node.js 22 in CI; use the repository's configured version if a devcontainer or version manager specifies one.

## 2. Install dependencies if needed

```bash
test -d node_modules && echo "Dependencies already installed" || npm install
```

If package dependencies or the lock file have changed, run `npm install` and commit the corresponding lock-file changes only when intentional.

## 3. Check environment configuration safely

Do not print the contents of environment files to the terminal or paste secrets into issues, chat, screenshots, or logs.

```bash
test -f .env.local && echo ".env.local exists" || echo ".env.local is missing"
```

If it is missing, inspect the variable names in the template (not secret values), then create the local file:

```bash
cp .env.example .env.local
nano .env.local
```

Fill in the required values for your development environment. At minimum, the build requires `NEXTAUTH_SECRET`; authenticated functions may also require a valid `DATABASE_URL`, configured auth provider values, and other variables described in [ARCHITECTURE.md](ARCHITECTURE.md). Do not use production secrets in a Codespace unless your security policy explicitly permits it.

## 4. Generate Prisma client

```bash
npm run db:generate
```

This generates the Prisma client; it does not start or provision PostgreSQL. Database-backed functionality requires a reachable, correctly configured development database.

## 5. Start Next.js on port 3000

In terminal 1, run:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Leave this terminal running. Wait until the dev server reports that it is ready. If port 3000 is already occupied, do not blindly kill the process; inspect it first using the troubleshooting commands below.

## 6. Confirm the local server responds

Open a second terminal and run:

```bash
curl -I http://localhost:3000
```

Any HTTP response confirms that the local socket is reachable, although a 4xx/5xx response may still indicate an application-level problem. For the homepage response body, run:

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000/
```

A connection-refused error usually means the server isn't running or listening on the expected port. Review the first terminal for build/runtime errors.

## 7. Forward the port in Codespaces

1. Open the **Ports** tab in the bottom panel.
2. Select **Forward a Port** if port 3000 is not listed, and enter `3000`.
3. Check that the local port is `3000` and copy/open the **Forwarded Address** shown by Codespaces.
4. Treat the Ports tab as the source of truth. The forwarded subdomain can change with a different Codespace or port mapping.
5. Keep the visibility set to **Private** unless public sharing is deliberately required. Private ports require the viewer to be authorized. Do not switch to Public simply to work around an application error.

The expected URL for the previously shared Codespace is:

`https://curly-dollop-xqqw5jww4g6fpwj7-3000.app.github.dev/`

If the Ports tab shows a different URL, use the address displayed there.

## 8. Verify the preview

Open the forwarded HTTPS URL in a browser. Test the public homepage and navigate any pages needed for your review. A working homepage does not prove authentication, database-backed routes, payment webhooks, emails, or other integrations are configured.

## Troubleshooting

### Port 3000 does not respond locally

```bash
ps -ef | grep -E 'next dev|next-server' | grep -v grep
ss -ltnp | grep ':3000' || true
curl -v http://127.0.0.1:3000/
```

If the server is stale, stop it with `Ctrl+C` in the terminal that owns it and restart using the command in section 5.

### Localhost responds, but the forwarded URL does not

Confirm port 3000 appears in the Ports tab, open the address listed there, and verify the port visibility and authorization. Do not assume an old forwarded URL is still correct.

### Environment or authentication errors

Check that required variable names are present without printing their values. Review [ARCHITECTURE.md](ARCHITECTURE.md) and [AUTH-SETUP.md](AUTH-SETUP.md). A running page can still show authentication errors if `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, or identity-provider settings are incorrect for the development environment.

### Prisma or database errors

Run:

```bash
npm run db:generate
npm run db:validate
```

These commands validate/generate the client; they do not prove that a database is reachable. Check your development `DATABASE_URL` and migration state. Do not run migrations against production as a troubleshooting shortcut.

### Port is already occupied

```bash
ss -ltnp | grep ':3000' || true
```

Identify the owning process before stopping anything. Never terminate unknown processes blindly.

## Completion checklist

- [ ] Next.js dev server starts without a fatal error.
- [ ] `curl -I http://localhost:3000` receives an HTTP response.
- [ ] Codespaces Ports lists port 3000 and displays a forwarded HTTPS address.
- [ ] The forwarded page opens in a browser.
- [ ] Required pages are navigable; integration status is checked separately.
- [ ] Port visibility remains Private unless public access has been explicitly approved.

This procedure supports development preview only. It does not publish a production site or establish production readiness.
