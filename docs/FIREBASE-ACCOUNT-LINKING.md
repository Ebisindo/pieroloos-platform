# Firebase UID account-linking contract

This contract is a prerequisite for enabling step-up operations.

## Required model

A local PieroloOS user may be associated with exactly one Firebase UID in the configured Firebase project. The record must be created only by an authenticated, independently verified account-linking flow; email equality is insufficient to associate the accounts.

- Firebase project ID and UID are stable identifiers. Email addresses may change and must not be used as the join key.
- Require an authenticated local session and a recent Firebase authentication / supported MFA flow before linking.
- Ensure the Firebase UID is not already bound to another local user (unique constraint).
- Store the Firebase project ID and UID, link time, linking actor and audit reference. Use a database uniqueness constraint, and forbid routine user-facing mutation of the binding.
- Explicitly verify the Firebase token through Admin SDK with revocation check. Never accept decoded client claims.
- Account unlinking/rebinding must require a higher-assurance recovery process, independent review and auditable confirmation. No administrator or successor gains access solely through the mapping.
- Do not use environment variable names formed from a user ID as a permanent mapping mechanism.

## Release status

The runtime foundation still needs this first-class association in Prisma, migration and account-link route/service implementation, with integration tests for cross-account collision, wrong project, revoked token, stale authentication and audited unlink/rebind denial. Until then Firebase step-up challenges must not authorize continuity mutations.
