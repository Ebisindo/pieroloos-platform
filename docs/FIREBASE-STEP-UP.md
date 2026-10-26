# Firebase Authentication step-up workflow

Firebase project: `pieroloos-platform`.

## Runtime configuration

- `FIREBASE_PROJECT_ID=pieroloos-platform`
- Use workload identity/Application Default Credentials where available, or a dedicated server-side secret manager credential. Never commit service-account JSON/private keys.
- `FIREBASE_UID_MAP_<LOCAL_USER_ID>` is a temporary explicit UID binding gate. Configure it only through protected deployment secrets until the application gains a formally reviewed account-linking table. It is deliberately not resolved by email.
- Enable Firebase Authentication MFA in the project and verify that the selected factor is supported by the web client flow. A user merely having an enrolled factor is not proof that a particular sign-in used MFA.

## Step-up flow implemented in the branch

1. An authenticated NextAuth session calls `POST /api/auth/firebase-step-up` with an allow-listed continuity operation and a Firebase ID token obtained after an interactive Firebase MFA reauthentication flow.
2. The server verifies the token with Firebase Admin SDK `verifyIdToken(token, true)`, checks project issuer/audience/UID, expiration and recent `auth_time`, and requires the verified `firebase.sign_in_second_factor` claim.
3. The server validates a preconfigured UID binding for the current local user (not an email match), creates a cryptographically random handle, stores only its SHA-256 digest, and binds it to the user, Firebase UID, operation, session fingerprint and a two-minute expiry.
4. A protected mutation must consume the handle with an atomic conditional update inside the same database transaction as the domain write and audit row. Any zero-row consumption denies the operation and the transaction must roll back.
5. The continuity route remains fail-closed until every operation has been wired through this exact transactional contract and independently reviewed.

## Security/test coverage in this change

Unit tests cover correct and incorrect issuer/audience, missing subject, expiry, future or stale authentication time, missing/empty MFA claim, opaque-handle entropy shape and digest hashing. Integration staging must still cover revoked Firebase tokens, wrong UID binding, wrong operation/user/session, expired/replayed handle, simultaneous consumption, database/audit failure and rollback.

## Staging procedure

1. Use a dedicated non-production Firebase project/client and disposable staff accounts. Do not use production user accounts or assets.
2. Configure Firebase MFA with the supported factor; establish an explicit local-user-to-Firebase-UID mapping through protected runtime configuration, never by email.
3. Deploy the candidate to an isolated staging URL after database backup and migration review.
4. Apply the additive migration in staging, regenerate Prisma client, and run lint, typecheck, unit tests, DB integrity tests, build and E2E.
5. Execute valid-MFA and negative/replay/concurrency cases, collect sanitized workflow URLs and audit event IDs, and prove rollback.
6. Obtain security/identity and database approvals for the exact candidate SHA before enabling sensitive continuity writes.

No staging result is claimed in this document until a real staging environment and disposable test identities have been exercised.
