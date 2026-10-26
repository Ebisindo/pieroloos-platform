# Firebase step-up runtime: release gates and operator runbook

This branch adds a server-side Firebase token verifier and challenge persistence as a foundation. It is **not yet an authorization enablement**: the successor route intentionally remains fail-closed.

## Prerequisites

- Deploy the migration and regenerate Prisma client only in isolated staging first.
- Install dependencies from the updated lockfile after adding `firebase-admin`.
- Provide `FIREBASE_PROJECT_ID=pieroloos-platform`.
- Prefer workload identity/Application Default Credentials. If service-account environment variables are used, configure them through protected hosting secrets, not GitHub source, Actions logs, or comments.
- Establish the explicit local-user-to-Firebase-UID mapping through a reviewed account-linking process; do not use email matching.
- Use dedicated disposable staging identities and no production data/assets.

## Current implementation boundary

- Firebase Admin `verifyIdToken(token, true)` performs signature/project token verification and revocation validation.
- The policy validator checks issuer/audience/subject, expiration, authentication recency (5 minutes by default), and a non-empty verified `firebase.sign_in_second_factor`.
- Challenge records persist the handle digest, local user, Firebase UID, operation, session fingerprint, authentication time, factor and expiry.
- Consumption is an atomic conditional update and **must be called inside the same Prisma transaction as the operation and audit insert**. It must not be consumed in a separate transaction.
- Protected continuity mutations must continue returning 503 until every action is wired to challenge consumption in the transaction that writes the domain change and audit event, and the tests/reviews below pass.

## Tests required for merge

- Test claim policy: valid proof; bad issuer/audience/UID; expired and stale/future auth_time; absent/empty MFA claim.
- Test actual Admin SDK verification: invalid signature, wrong Firebase project, revoked token, disabled account and emulator/staging fixture. Never use invented unsigned JWTs as a positive token-verification test.
- Test challenge persistence: wrong local-user UID mapping, wrong operation, wrong session, expiry, single-use replay, concurrent double-consumption, database transaction rollback and audit-write failure.
- Test all POST/PATCH mutation paths deny without a valid handle and assert zero mutation/notification/privilege side effects.
- CI must run Prisma validate/generate, migration inventory, DB integration, lint, typecheck, unit tests, production build and E2E on the exact head SHA.

## Staging validation evidence

Staging has **not** been run by this change. Record the staging origin (not credentials), Firebase project ID, candidate SHA, migration result, workflow URLs, sanitized test outcomes, audit identifiers, review approvals and rollback outcome when a real staged run is performed.

## Non-negotiable safety boundary

Inactivity starts a manual review only. No automatic SuperAdmin promotion or transfer of legal ownership, GitHub repositories, cloud deployments, secrets, domains or billing based on inactivity. Never release plaintext secrets to successors.
