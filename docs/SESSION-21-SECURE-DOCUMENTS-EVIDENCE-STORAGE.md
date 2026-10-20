# Session 21 — Secure Documents & Evidence Storage

Session 21 makes documents tenant-scoped evidence records backed by private, encrypted, S3-compatible object storage. The application integration is implemented; production readiness is **not** claimed until an object bucket, malware scanner, backup/recovery process, and operational policies are configured and verified.

## Implemented lifecycle

1. Authenticated workspace members upload multipart files up to 25 MiB. The API validates allowed MIME types, file signatures, metadata, byte size, and a caller-provided SHA-256 against the actual bytes. Live workspace authorization and the required retention policy are rechecked before writing to object storage, then checked again in the metadata transaction.
2. The application derives organization/workspace identity from the authenticated principal, creates a UUID-backed tenant/version key, and stores the object using S3 server-side encryption and a SHA-256 checksum.
3. The database records metadata, checksum, version chain, retention deadline, scanner state, review state, and workspace scope. If the database transaction fails after an object write, the application attempts cleanup; cleanup failure is surfaced explicitly.
4. New objects start as `PENDING_SCAN`. Only a scanner callback authenticated with the separate `DOCUMENT_SCANNER_WEBHOOK_SECRET`, reporting a matching checksum and a clean result, makes a document `AVAILABLE`. Failed or mismatched scans remain unavailable; infected content is permanently denied signed downloads.
5. Downloads require the active workspace and `documents:read`; they create a 5-minute signed URL and an access event. Review, metadata listing, upload, scanning, evidence linking, and soft deletion are also recorded as document access events.
6. A new version can only be based on the current, clean, available latest version. Version updates use a transactional compare-and-swap on the root record. The prior version becomes superseded after the scanner approves its replacement.
7. Compliance and cross-border evidence linking and formation-task evidence satisfaction require clean, available, non-deleted documents and repeat that check in the write transaction.
8. Soft deletion applies to the whole version family and is blocked until the latest applicable workspace retention period expires. Objects are not physically removed by the soft-delete endpoint.
9. PostgreSQL composite foreign keys bind documents, version ancestry, compliance evidence, and access events to a matching workspace; an ID from another tenant cannot satisfy these relations.

## Configure before use

Set these values through a deployment secret manager, not source control:

```text
OBJECT_STORAGE_BUCKET=<private bucket with block-public-access enabled>
OBJECT_STORAGE_REGION=<region supported by provider>
OBJECT_STORAGE_ENDPOINT=<optional S3-compatible endpoint; omit for AWS S3>
OBJECT_STORAGE_ACCESS_KEY_ID=<optional when the runtime uses workload identity>
OBJECT_STORAGE_SECRET_ACCESS_KEY=<paired credential when access key is set>
OBJECT_STORAGE_SERVER_SIDE_ENCRYPTION=AES256
OBJECT_STORAGE_KMS_KEY_ID=<required when encryption is aws:kms>
DOCUMENT_SCANNER_WEBHOOK_SECRET=<independent high-entropy callback secret>
```

The application rejects a partially supplied static credential pair and only permits `AES256` or `aws:kms`; a KMS key ID is mandatory for the latter. Configure the bucket itself as private, require TLS, enable provider-side versioning and durable backups according to the operator's recovery policy, and grant the runtime only the object operations it needs. Signed URLs are capped at 15 minutes; the application currently issues five-minute downloads.

Every workspace must have `documentRetentionDays` configured by a user with settings-management permission before an upload or version can proceed. There is intentionally no global or seed default. Configure it from **Settings → Document retention policy (days)**; accepted values are 1–36,500. Each upload records its calculated `retainUntil`. Deletion is a soft-delete, never a direct object delete. Automatic purge, legal holds, retention exceptions, and jurisdiction-specific schedules are not implemented and must be governed before any physical deletion policy is enabled.

## Malware scanning boundary

This repository supplies a fail-closed quarantine state and authenticated callback; it does not bundle an antivirus engine or scanning worker. Configure the private bucket's object-created event (or an equivalent private queue) to a managed scanner. The scanner must read the quarantined object, verify its bytes against the recorded SHA-256, scan it in an isolated environment, and POST `{ "documentId", "checksumSha256", "result", "scanner" }` to `/api/workers/documents/scan-results` using `Authorization: Bearer <DOCUMENT_SCANNER_WEBHOOK_SECRET>`. Do not expose this credential to browsers or use the operational worker secret for this callback. A missing scanner leaves documents unavailable, by design.

Do not mark documents clean using a manual or application-user action. Scanner delivery, retry/dead-letter handling, scanner updates, isolation, and security incident response must be exercised by the deployment operator.

## Database and legacy-data migration

The forward migration `20261005235500_secure_document_storage` adds lifecycle and access-log tables/fields, the workspace retention setting, version relationships, and the compliance-evidence foreign key. It preserves existing document rows but labels their scan state `LEGACY_UNVERIFIED`; those rows cannot be downloaded or attached as evidence until the configured scanner has independently verified the real stored object and its checksum. A missing legacy storage key or checksum is marked with a `legacy-unverified` placeholder and requires explicit data recovery; it is not treated as valid content. The migration stops rather than silently proceeding if existing compliance-evidence links are orphaned or storage keys are duplicated.

Run the normal Session 19 migration replay and drift pipeline on a disposable PostgreSQL database before deploying. No production/staging database or real cloud bucket has been accessed by this session.

## Verification and outstanding exit gate

Unit tests cover signature/MIME mismatch, checksum mismatch, tenant-derived keys, encryption/checksum storage requests, signed URL expiry limits, scanner checksum mismatch, quarantine-to-clean state transition, previous-version supersession, version-parent and stale-version rejection, cleanup after failed persistence, retention enforcement, and soft-delete policy. The PostgreSQL suite verifies migration/schema equality, tenant-scoped document/client, version, evidence, and access-event foreign keys, version uniqueness, and the existing authorization-boundary scenarios.

The Session 21 exit gate remains open until:

- A production-like private S3-compatible bucket is configured and tested, including encryption, credentials/IAM, signed URL expiry, backup, and object recovery.
- A real isolated malware scanner is integrated and its event, failure, retry, infected-file, and recovery paths are exercised end to end.
- PostgreSQL migration replay, document tenant-boundary, evidence-link integrity, and concurrent version tests pass.
- Retention ownership and legal-hold requirements are approved; automatic purge and storage-level deletion controls are separately designed and verified.
- Legacy documents are inventoried and either recovered/scanned or explicitly retained as inaccessible.

Documents must remain unavailable by default when any storage or scanner prerequisite is missing.
