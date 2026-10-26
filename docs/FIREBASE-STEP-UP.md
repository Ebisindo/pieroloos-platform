# Firebase Authentication step-up implementation notes

Project: `pieroloos-platform`
Firebase project ID: `pieroloos-platform`
Expected Firebase ID-token issuer: `https://securetoken.google.com/pieroloos-platform`
Expected ID-token audience: `pieroloos-platform`
Expected token subject: Firebase UID (`sub`).

## Security interpretation

The server must verify client ID tokens using the Firebase Admin SDK and the configured project ID. Use `verifyIdToken(idToken, true)` where revocation checks are required. Never trust decoded client-side claims. Never log the bearer token or decoded personal payload.

For a Firebase ID token authenticated with a second factor, Firebase documents `firebase.sign_in_second_factor` on the verified token's `firebase` claim. `auth_time` is the original authentication time for the session, not the timestamp when the token was refreshed. Therefore token refresh alone does not renew step-up freshness.

This project must not treat `email_verified`, presence of an enrolled second factor, a generic OAuth login, or a Firebase token by itself as proof of an operation-specific, recent step-up. The second-factor claim can be useful evidence of how that sign-in occurred, but does not prove that the challenge was performed for the current sensitive operation.

## Runtime credentials

Configure only the Firebase project ID in ordinary runtime configuration, for example `FIREBASE_PROJECT_ID=pieroloos-platform`. Use Application Default Credentials or a runtime-mounted secret manager/service-account credential for Admin SDK authentication. Do not commit a service-account JSON file, private key, client secret, session cookie, or bearer token. The public web Firebase config/API key identifies the client project; it is not a server credential and must not be mistaken for one.

## Required implementation sequence

1. Add and test a server-only Firebase Admin verifier that checks the configured project ID, signature, expiry, issuer/audience/UID, and revocation where required, and returns a minimal typed identity/MFA view instead of passing the full token payload downstream.
2. Implement an interactive step-up challenge endpoint that requires a fresh Firebase reauthentication and an MFA sign-in result; bind the challenge to the current local user, Firebase UID, session, target operation and expiry.
3. Add persistence for a cryptographically random single-use challenge/handle (store a hash only). Consume it atomically in the same database transaction as the authorized domain mutation and audit row. Fail closed on concurrency, provider outage, missing MFA claim, account mismatch, stale `auth_time`, replay, or audit failure.
4. Implement the client Firebase MFA flow using the supported Firebase Auth SDK challenge/resolver flow. Do not make claim values, MFA booleans or timestamps client-controlled inputs.
5. Update the existing NextAuth/account mapping only after a trusted stable mapping from the existing local user to Firebase `uid` has been established. Never map users by mutable email alone.
6. Keep all continuity POST/PATCH operations fail-closed until the complete interactive challenge, one-time transactional handle, independent security/identity review, database review and staging evidence are complete on the same candidate SHA.

## Test requirements

Unit/integration tests must reject invalid signature, wrong project/audience, missing/empty UID, expired token, revoked token, no second factor, absent/empty `firebase.sign_in_second_factor`, stale `auth_time`, local-user/Firebase-UID mismatch, expired or wrong-operation challenge, replay, race/concurrent double-consumption, audit or database failure, request-origin failure, and provider outage. Positive tests must use emulator or staging-issued credentials and must never add real tokens to fixtures.

## Release safeguards

No automatic successor promotion or transfer of legal ownership, repositories, secrets, deployments, domains or billing based on inactivity alone. Inactivity triggers a review workflow only. Do not enable sensitive continuity writes until required independent reviewers approve and staging proof is captured.
