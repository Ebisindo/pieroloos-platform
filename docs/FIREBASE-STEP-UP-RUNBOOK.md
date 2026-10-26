# Firebase step-up runtime: release gates and operator runbook

This branch adds Firebase Admin verification, the two-phase MFA challenge, a durable Firebase UID link, and a transactional consumption contract. Keep the PR in draft until the exact candidate SHA passes CI/Security, independent review is recorded and a real isolated staging exercise is complete.

## Configuration and isolated environment

- `FIREBASE_PROJECT_ID` must identify the Firebase project for the specific environment. Production uses `pieroloos-platform`; staging should use a separate, isolated Firebase project and a separate staging database whenever available. The project ID must match the web app's `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
- Set `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID` from that environment's Firebase web app configuration. These are client configuration values; API key restrictions still apply.
- Prefer workload identity / Application Default Credentials for Admin SDK. If a service-account key is needed, store it only in a protected hosting secret store. Never commit service-account JSON, private keys, ID tokens, passwords, SMS codes or session cookies.
- Enable Email/Password authentication and SMS Multi-Factor Authentication for the disposable staging identity. Configure Firebase authorized domains and phone MFA testing appropriately.
- The UI supports an enrolled SMS phone factor for this initial implementation; other second-factor types are not yet wired into the dialog. A missing or unsupported MFA factor must fail closed.

## Durable Firebase UID association

Each PieroloOS local user may be linked to one Firebase UID through the `FirebaseIdentity` registry. The `(userId, projectId)` and `(projectId, firebaseUid)` pairs are unique, and the registry row links to the operator and a corresponding `PlatformAuditEvent`. The association is not derived from email and cannot be overwritten through this tool.

After verifying the target identity out-of-band, configure the Admin SDK to the intended staging Firebase project and the app to the intended staging database. Run:

```bash
npm run admin:link-firebase-uid -- \
  --user-id <local-user-id> \
  --firebase-uid <firebase-uid> \
  --actor-user-id <current-superadmin-user-id> \
  --confirm
```

The script verifies the current Super Administrator, target staff account, Firebase user existence/enabled state and at least one enrolled MFA factor. The association and audit record are committed in a serializable transaction. It refuses reassignment when a different UID is already linked; that requires a separately reviewed recovery procedure. Never paste account secrets or credentials into GitHub.

## Runtime flow

1. The current Super Administrator starts a protected action. The browser calls `POST /api/auth/firebase-step-up` with the allow-listed operation. The server verifies the signed NextAuth session, current role and Firebase UID association, then stores a hash of a random five-minute nonce.
2. The browser performs a Firebase email/password sign-in. When Firebase reports `auth/multi-factor-auth-required`, the UI resolves the enrolled phone factor and reCAPTCHA and obtains an ID token from the completed MFA sign-in.
3. The browser calls `POST /api/auth/firebase-step-up/complete` with the operation, nonce and ID token. The server uses Firebase Admin `verifyIdToken(token, true)`, checks project-bound issuer/audience, UID, revocation/disabled state, recent `auth_time`, and the verified `firebase.sign_in_second_factor` claim. The auth time must be strictly later than nonce creation.
4. A serializable transaction marks the challenge verified and stores a unique SHA-256 fingerprint of the proof token. The nonce is a usable operation handle only after successful verification.
5. The corresponding protected POST/PATCH transaction atomically consumes the verified, unexpired handle using user, session fingerprint, operation and handle hash predicates, then performs the domain write, audit insert and related notification work in that same transaction. If any write or audit fails, the transaction must roll back consumption and all side effects.
6. Starting a newer challenge invalidates outstanding attempts for the same user/session. A mismatched user, session or operation, expired nonce, invalid/revoked token, missing MFA claim or replay must fail closed.

Do not log request bodies, ID tokens, SMS codes, passwords, challenge nonces, service-account data or session cookies.

## Tests required before merge

- Claim policy: issuer/audience/subject mismatch, expiry, future/stale auth_time, stale iat and missing MFA claim.
- Real Admin SDK verification with Firebase Emulator or dedicated staging tokens: bad signature, wrong Firebase project, revoked token and disabled user. Do not use fabricated unsigned tokens as positive verification evidence.
- UID association: missing UID, UID mismatch, duplicate UID, disabled user, MFA unenrolled user and attempted reassignment.
- Challenge lifecycle: auth time predating nonce, nonce expiry, wrong user/session/operation, unique proof fingerprint, new challenge invalidating old challenge, replay, concurrent completion and concurrent consumption.
- Route side effects: no or unverified step-up handle gives denial with zero mutation/audit/notification/privilege side effects. Wrong operation must not consume another operation's handle. A failed domain write or audit write must roll back handle consumption.
- Exact-SHA checks: dependency lockfile consistency, Prisma validation/generation, migration inventory, PostgreSQL data-integrity tests, lint, typecheck, unit tests, production build, Playwright E2E, dependency audit, CodeQL and secret scan.

## Staging validation procedure

1. Create or select an isolated staging deployment, a dedicated Firebase project and disposable Firebase MFA-enabled staff identities. Use a separate PostgreSQL staging database and a separate shadow database. Do not exercise production user accounts or assets.
2. Provision staging runtime variables in the hosting secret configuration and verify that server `FIREBASE_PROJECT_ID` equals browser `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. Do not record secret values in evidence.
3. Review the migrations and backup/restore plan. Apply migrations with `npm run db:deploy -- staging` only after setting `DATABASE_URL_STAGING` and `SHADOW_DATABASE_URL_STAGING` to different databases. Run `npm run db:generate`.
4. Link a disposable staff identity using the audited UID-linking command and confirm MFA enrollment.
5. Deploy the exact SHA after required checks and reviews. Run valid phone-MFA flow and negative tests for stale tokens, invalid UID, wrong operation/session, expired nonce, repeated token, concurrent completion/consumption, disabled user, DB error, audit error and rollback.
6. Verify that each denied attempt produces no mutation, queue or privilege side effects. Confirm audit rows exist for valid actions without credentials or raw token payloads.
7. Save sanitized workflow URLs, exact candidate SHA, migration run result, test outcomes, audit row IDs and rollback evidence. Have independent security/identity and database reviewers approve this exact SHA. Any code change requires new CI and re-review.

**Staging is not validated merely because GitHub Actions passes.** There is no staging result until the real isolated runtime, Firebase MFA account and database have been exercised and evidence recorded.

## Release safety boundary

Inactivity starts a manual review only. It must never automatically promote a successor or transfer legal ownership, GitHub repositories, secrets, deployments, domains or billing. The step-up nonce authorizes one matching operation once; it is not a persistent privilege grant. Do not enable production recovery or successor transfer functionality without the required independent reviews and provider-specific controls.
