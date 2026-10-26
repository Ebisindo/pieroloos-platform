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

Call `enableWebPushNotifications()` only from a deliberate user action, such as an “Enable notifications” button. It requests permission, registers `/firebase-messaging-sw.js`, and returns the Firebase registration token. Handle `ok: false` without treating it as a fatal app error. Use `onForegroundPush(callback)` while a page is active and invoke its returned cleanup function when the listener is no longer needed.

Web Push requires a secure context (HTTPS, except localhost), browser support, Firebase Cloud Messaging enabled, and the correct VAPID key. Do not prompt on initial page load.

## Current boundary / rollout gates

This commit does not automatically subscribe users, persist registration tokens server-side, associate tokens with a staff/client identity, or send pushes from server workflows. Those require authenticated token lifecycle endpoints, ownership and revocation rules, notification-event mapping, delivery retries, abuse controls, and independent tests. Until those pieces exist, this is the browser integration layer only—not end-to-end notification delivery. Do not claim production push delivery is enabled based on token acquisition alone.

Validate the project and web app in Firebase Console, configure environment values in the hosting secret/configuration store, run unit/type/lint/build and browser tests, and perform end-to-end delivery tests in an isolated staging project before enabling production use.
