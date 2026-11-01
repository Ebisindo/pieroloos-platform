# Firebase Authentication step-up workflow

Firebase project: `pieroloos-platform`.

## Intended security boundary

This is a secondary, provider-backed step-up control for the current PieroloOS Super Administrator session. It does not replace the existing NextAuth session or create an administrative grant. The current local user and Firebase user are paired through the `FirebaseIdentity` registry. `(userId, projectId)` and `(projectId, firebaseUid)` are unique; the mapping references the operator and a corresponding `PlatformAuditEvent`.

## Configuration

Server-side runtime:
- `FIREBASE_PROJECT_ID=pieroloos-platform`
- Prefer workload identity / Application Default Credentials. If a service-account credential is needed, put it only in a protected runtime secret store. Never commit service-account JSON, private keys, ID tokens, passwords or SMS codes.
- The step-up verifier uses Firebase Admin SDK `verifyIdToken(token, true)`, so project-bound signature/expiry validation and revocation/disabled-account checks are performed by the SDK.

Browser runtime:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pieroloos-platform.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID=pieroloos-platform`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

These `NEXT_PUBLIC_` values are web-client configuration, not service-account credentials. Apply suitable API-key application/API restrictions in the Firebase/Google Cloud console. Do not place secrets in these variables.

The current UI implementation authenticates an email/password Firebase staff account and handles the enrolled SMS phone MFA factor using the Firebase Web SDK and reCAPTCHA. For staging, enable Email/Password sign-in and phone MFA, set authorized domains correctly, and enroll a disposable staff account. Other Firebase MFA factor types are not wired to this initial dialog yet.

## Durable UID association

The `FirebaseStepUpChallenge` service checks the mapped `FirebaseIdentity` row; it never matches a Firebase identity by email. Link an existing staff account from a trusted operator workspace after the target Firebase UID has been verified through an approved out-of-band process and the user is enrolled in MFA:

```bash
npm run admin:link-firebase-uid -- \
  --user-id <local-user-id> \
  --firebase-uid <firebase-uid> \
  --actor-user-id <current-superadmin-user-id> \
  --confirm
```

The script verifies that the actor is the currently provisioned Super Administrator, the target is an existing staff account, the Firebase user exists and is enabled, and at least one MFA factor is enrolled. It writes the `FirebaseIdentity` row and linked audit event in the same serializable database transaction. It will not overwrite an existing mapping; reassignment requires a separately reviewed recovery procedure.

Run the command only against the intended staging database and the intended Firebase project when validating staging. Do not paste real account IDs, private keys, passwords or MFA codes into GitHub issues or pull requests.

## Two-phase per-operation challenge

1. The authenticated Super Administrator opens a protected action. The browser calls `POST /api/auth/firebase-step-up` with the allow-listed action name.
2. The server confirms the signed NextAuth session and current Super Administrator assignment, checks same-origin and rate limits, invalidates outstanding attempts for that user/session, and creates a cryptographically random five-minute nonce. Only its SHA-256 digest is stored.
3. The browser performs a Firebase email/password sign-in. If Firebase requires MFA, the UI resolves the SMS second-factor challenge and reCAPTCHA before obtaining a refreshed Firebase ID token.
4. The browser calls `POST /api/auth/firebase-step-up/complete` with the operation, nonce and Firebase ID token. The server verifies the token with Admin SDK revocation checks, requires the configured Firebase project issuer/audience, matching persisted Firebase UID, recent `auth_time`, and a non-empty verified `firebase.sign_in_second_factor` claim. The token's `auth_time` must be strictly later than the stored challenge creation time.
5. The server atomically marks that challenge verified and stores a unique SHA-256 token fingerprint. The nonce remains the operation-bound handle; it is not accepted by protected mutations until `verifiedAt` is set. The unique token fingerprint prevents the same ID token from completing multiple attempts.
6. The protected POST/PATCH route validates the action and atomically consumes the verified handle in the same serializable Prisma transaction as the domain write and audit row. A mismatch, expiry, replay, wrong action, wrong session, database failure or audit failure aborts that transaction.

Starting another attempt invalidates earlier unused attempts for that session. The random nonce is never stored in plaintext. ID tokens, passwords and SMS codes must never be logged or persisted.

## Test requirements

Unit and integration tests must cover:
- Correct/incorrect issuer and audience, empty subject, expired token, future/stale `auth_time`, stale `iat`, missing MFA claim, disabled/revoked user, wrong project and invalid signature.
- No Firebase UID association, association to a different UID, duplicate UID, UID reassignment attempt and disabled or MFA-unenrolled Firebase accounts.
- Challenge created before authentication; authentication time not newer than challenge; expired challenge; wrong user, session or operation; token fingerprint replay; challenge nonce replay; multiple outstanding challenge invalidation and concurrent completion.
- Protected mutation without a handle, unverified handle, expired/replayed handle, wrong action/session, concurrent consumption, domain failure and audit failure. Verify the database transaction rolls back both handle consumption and all mutation/audit rows.
- No side effects on rejected requests, including notification queue writes and privilege changes.

Positive token tests must use Firebase Auth Emulator or a dedicated staging project; fake unsigned JWT fixtures may only be used to test claim-policy logic, never as proof that signature validation works.

## Staging procedure

1. Use an isolated staging deployment, a non-production PostgreSQL database and a dedicated Firebase staging project or expressly isolated test identities. No production assets or credentials.
2. Supply the browser Firebase web configuration and protected server-side Admin SDK credentials. Confirm the expected project ID in deployment logs without logging any credential values.
3. Review and apply the additive migrations with a backup; run `npm run db:deploy -- staging` with separated staging/shadow URLs, then run `npm run db:generate`.
4. Link one disposable Super Administrator staff account to its Firebase UID using the audited CLI. Verify Firebase MFA enrolment and complete the actual UI phone-MFA flow.
5. Run migration inventory, Prisma validate/generate, database integrity tests, lint, TypeScript, unit tests, production build, Playwright and Security checks on the same candidate SHA.
6. Exercise valid step-up, stale-token rejection, wrong operation/session, expired/replayed nonce, concurrent completion, concurrent handle use, disabled/revoked Firebase account, same-token replay, DB failure and audit rollback. Capture sanitized workflow URLs, candidate SHA and audit identifiers.
7. Obtain independent security/identity and database reviewer approvals for that exact SHA. Document rollback evidence before considering production enablement.

No staging result is claimed until a real staging environment, Firebase MFA account and database have been exercised. GitHub Actions CI alone is not staging evidence.

## Release safeguards

Inactivity starts a manual review only. It must never automatically promote a successor or transfer legal ownership, GitHub repositories, cloud deployments, secrets, domains or billing. The continuity route stays disabled for sensitive actions until the full test suite, independent reviews and staging evidence pass. The Firebase challenge never grants persistent Super Administrator privileges or bypasses any external provider's own authorization controls.
