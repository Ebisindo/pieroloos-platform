# Firebase Web Push

This integration provides browser permission/token registration, foreground message hooks, and background notification display for the Firebase project configured for the current environment.

## Browser configuration

Set these values in the hosting environment from the Firebase web app settings:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (production: `pieroloos-platform`)
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Firebase Console → Project settings → Cloud Messaging → Web Push certificates)

The VAPID key is a public key. Never place a VAPID private key, Firebase Admin service-account JSON, private key, or service credential in a `NEXT_PUBLIC_*` variable or source control. If a service-account credential was ever exposed, revoke/rotate it independently; this feature does not remediate exposed credentials.

## Browser usage

Call `enableWebPushNotifications()` only from a deliberate user action, such as an “Enable notifications” button. It requests permission, registers `/firebase-messaging-sw.js`, obtains a Firebase token, and sends it to the authenticated same-origin token endpoint. The endpoint binds the token to the signed-in user, enables push for the selected workspace, enforces a ten-active-browser cap, rejects tokens owned by another user, and supports token rotation via `previousToken`. It returns the token only after server registration succeeds. Use `disableWebPushNotifications(token)` to revoke a token and disable push for the active workspace. Use `onForegroundPush(callback)` while a page is active and invoke its returned cleanup function when the listener is no longer needed.

Existing in-app notifications enqueued through `notificationRepository.enqueue` now produce a separately deduplicated `PUSH` outbox row. The worker sends push rows through Firebase Admin, records provider acceptance in the existing delivery-attempt ledger, retries transient failures with the existing backoff, dead-letters permanent failures, and revokes provider-invalid tokens. Delivery is only attempted when the recipient has explicitly enabled push for the relevant workspace and has an active token.

Web Push requires a secure context (HTTPS, except localhost), browser support, Firebase Cloud Messaging enabled, and the correct VAPID key. Do not prompt on initial page load.

## Current boundary / rollout gates

This branch now includes the application-side token lifecycle and a push outbox path, but end-to-end delivery is not yet verified. Registration tokens are stored in the database and must be treated as sensitive operational data; do not log them or expose them in admin views. Existing notifications are fanned out only when enqueued through `notificationRepository.enqueue`; audit other direct notification creation paths before claiming complete event coverage. The active-token cap is a per-user safety limit, not a general-purpose distributed rate limiter.

Validate the project and web app in Firebase Console, configure environment values in the hosting secret/configuration store, run unit/type/lint/build and browser tests, and perform end-to-end delivery tests in an isolated staging project before enabling production use.
