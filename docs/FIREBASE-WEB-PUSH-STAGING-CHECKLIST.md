# Firebase Web Push staging verification

This checklist is a release gate, not evidence that the checks have already passed.

## Preconditions

- [ ] Confirm the Firebase web app and Admin project both identify the intended isolated staging project.
- [ ] Enable Firebase Cloud Messaging and verify the VAPID public key in Firebase Console.
- [ ] Configure all required `NEXT_PUBLIC_FIREBASE_*` values in staging; configure `FIREBASE_PROJECT_ID` and workload identity / protected Admin credentials in the server runtime.
- [ ] Apply the additive Prisma migration to an isolated staging database using the repository's approved migration workflow.
- [ ] Confirm HTTPS, the service-worker response content type, and `/firebase-messaging-sw.js` registration.
- [ ] Use test accounts and test devices only; do not send to production users.

## Authorization and lifecycle tests

- [ ] Unauthenticated registration returns 401 and writes nothing.
- [ ] Cross-origin registration returns 403 and writes nothing.
- [ ] Malformed tokens return 400 and write nothing.
- [ ] A token already owned by a different account returns 409 and is never reassigned.
- [ ] The active-token cap returns 429; only a token already owned by the same account can be rotated out.
- [ ] Registration is bound to the signed-in account and selected workspace preference.
- [ ] Revocation only affects the signed-in user's matching token and disables push for the selected workspace.
- [ ] Rotation revokes the previous token only when it belongs to the signed-in user.
- [ ] Database unique constraints prevent concurrent duplicate token ownership.

## Delivery and failure tests

- [ ] A notification enqueued through `notificationRepository.enqueue` creates one deduplicated PUSH outbox item.
- [ ] PUSH delivery is cancelled when workspace notifications or the user's push preference are disabled.
- [ ] Foreground delivery invokes the foreground message callback.
- [ ] Background delivery displays the notification and click navigation stays same-origin.
- [ ] Invalid/unregistered tokens are revoked without logging token contents.
- [ ] Transient provider failures retry with existing backoff; permanent failures dead-letter.
- [ ] Partial provider failures retry and the stable notification tag reduces visual duplicates.
- [ ] Concurrent worker execution respects the existing database lease and attempt ledger.
- [ ] Worker logs contain notification IDs and safe failure codes only, never tokens or credentials.

## Required repository checks

Run from a clean checkout after applying the migration to a disposable test database:

1. `npm ci`
2. `npm run db:validate`
3. `npm run db:generate`
4. `npm test`
5. `npm run lint`
6. `npm run typecheck`
7. `npm run build`
8. `npm run test:e2e` with the browser test dependencies installed
9. Review all GitHub required checks on the exact final commit and obtain independent human review.

## Current verification status

The branch contains the implementation and automated tests, but CI, database migration execution, actual Firebase delivery, browser compatibility, and staging verification have not yet been observed. Do not enable production delivery until every applicable gate above is evidenced and reviewed.
