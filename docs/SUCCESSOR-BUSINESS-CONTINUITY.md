# Successor & Business Continuity

## Scope and security boundary

The Legacy & Successor Protocol records a named continuity contact, their consent, verification state, delegated continuity permissions, owner activity heartbeat, a warning window, and the evidence needed for a manual business recovery. It is not a legal will, probate instruction, proof of death/incapacity, or an automatic transfer of legal ownership.

The feature uses the existing singleton `PlatformSuperAdmin` authority. It does not promote an invitation email into an account and does not create a bypass around staff membership or NextAuth. A successor must be an existing staff user with an organization membership before any administrative role can be granted. Acceptance and email verification alone do not satisfy identity verification or MFA.

## Required controls

- Mutations require an authenticated current Super Administrator, a valid same-origin request, shared rate limiting, and a recent step-up authentication/MFA signal. Until the identity provider exposes and verifies a trusted step-up signal, add/revoke/activate operations fail closed.
- Invitation tokens are generated from cryptographically secure randomness; only their SHA-256 hashes are stored. Tokens are one-time, expire, and are removed after acceptance/revocation.
- The background worker uses `OPERATIONAL_WORKER_SECRET`, performs bounded idempotent transitions, sends an owner warning seven days before any activation review, and logs actions without tokens, credential values, or sensitive note plaintext.
- Inactivity initiates a pending handover review only. It does not silently transfer repos, cloud projects, secrets, billing, legal ownership, or the singleton Super Administrator account. Activation requires independent identity/MFA proof, required review evidence, and a verified existing staff account; ownership changes are a separate operator-controlled process.
- `canAccessSecrets` requires recorded identity/video verification evidence and an external vault's own access policy. PieroloOS never stores provider credentials or copies plaintext secrets into a transmission package.
- The transmission package includes asset inventory pointers and recovery/runbook references. Encrypted owner notes use envelope encryption backed by a production KMS; without a configured KMS adapter, saving or releasing a note is disabled.
- Simulation is non-destructive and never changes roles, permissions, provider state, keys, or billing.

## Activity and trigger semantics

The `lastOwnerActivityAt` heartbeat is updated by authenticated owner activity and by the explicit **I'm Alive** action. A daily worker checks verified inactivity and idempotently queues a warning at the configured trigger minus seven days. If the owner heartbeat remains stale after the trigger, the worker creates a handover review state and notifies designated contacts. The system must not infer death or incapacity from inactivity alone. The owner may cancel the review by re-authenticating; a reviewer can close the case with recorded evidence.

## Audit vocabulary

`successor_invited`, `successor_accepted`, `handover_warning_sent`, `handover_activated`, `ownership_transferred`, `successor_revoked`, `owner_alive_confirmed`, `handover_simulated`, and denied/failed transitions are recorded as `PlatformAuditEvent` rows in the same transaction as the domain change wherever possible. Audit metadata must exclude raw tokens, secret values, encrypted payload keys, and unnecessary personal data.

## Operations and rollout

1. Review the schema and additive migration; back up the target PostgreSQL database.
2. Apply `npm run db:deploy`, then `npm run db:generate`.
3. Configure the existing worker scheduler plus SMTP, shared Redis rate limiting, and a production identity provider with enforceable MFA/step-up authentication.
4. Configure provider-specific KMS envelope encryption before enabling encrypted-note functionality.
5. Run DB validation, migration inventory, lint, typecheck, focused route/service tests, and CI. In staging, verify invite replay/expiry, CSRF/origin rejection, non-admin rejection, race/idempotency behavior, warning cancellation, alert delivery failure, and that simulation never mutates access.
6. Exercise the recovery runbook with a disposable account and no production secrets; record evidence and rollback steps before production enablement.

## Transmission package inventory

Track GitHub organization/repositories, deployment projects, domains/DNS, database connection location (never its value), billing account recovery route, identity provider, object storage, CI/CD, DNS, monitoring, backups, secret-manager/vault location, key owners, and provider support/recovery URLs. Store references and recovery procedures—not credentials—in the package.

## Release-gate evidence record — 2026-10-26

Latest verified repository head at this review: `175b75f2035761f0d13e6bb6d82c7ae2a1945aad` (merge of the continuity mutation fail-closed and invitation-race test work).

GitHub Actions evidence for that exact SHA:
- [CI workflow](https://github.com/Ebisindo/pieroloos-platform/actions/runs/40296961358): `quality` and `e2e` completed successfully. The quality job covered database validation/migration and integrity checks, lint, TypeScript, unit tests, and production build; the E2E job covered production build and Playwright browser tests.
- [Security workflow](https://github.com/Ebisindo/pieroloos-platform/actions/runs/40296961360): CodeQL, Gitleaks secret-history scanning, and dependency audit completed successfully.

These are automated repository checks—not proof that the configured production identity provider supplies a trusted MFA/step-up assertion, that production SMTP/KMS/provider recovery works, or that independent reviewers have approved the operational design. No production readiness claim should be inferred from CI success.

### Remaining release blockers (must be evidenced, not inferred)

- [ ] Identity-provider owner supplies redacted provider documentation/configuration and a server-side claim-validation contract proving issuer/audience, recent authentication, MFA assurance, subject binding, expiry, and replay resistance. Never attach tokens, private keys, credentials, or unredacted personal data.
- [ ] Security/identity reviewer independent of the change author reviews the provider evidence and negative tests (forged, stale, wrong issuer/audience, expired, replayed).
- [ ] Database reviewer independent of the change author reviews migration/schema, concurrency tests, transaction rollback, cleanup isolation, and mutation inventory.
- [ ] Both reviewers explicitly approve the exact candidate SHA. Any subsequent code change requires new checks and review on its new SHA.
- [ ] Staging evidence verifies SMTP delivery/retries/dead-letter handling, warning cancellation, worker authentication, idempotency, invite expiry/replay, rate limiting, and rollback.
- [ ] Production KMS envelope encryption and provider-specific recovery procedures are implemented and independently tested before encrypted owner notes or sensitive recovery operations can be enabled.

Until every applicable gate is evidenced and reviewed, keep continuity mutations fail-closed. The current worker may create an audited review package only; it must not grant SuperAdmin access or transfer legal ownership, repositories, deployments, secrets, domains, or billing based only on inactivity.

