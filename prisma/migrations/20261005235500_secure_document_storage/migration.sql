CREATE TYPE "DocumentStorageStatus" AS ENUM ('PENDING_SCAN', 'AVAILABLE', 'INFECTED', 'DELETED');
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED', 'LEGACY_UNVERIFIED');
CREATE TYPE "DocumentReviewStatus" AS ENUM ('UNREVIEWED', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'SUPERSEDED');

ALTER TABLE "Document"
    ADD COLUMN "engagementId" TEXT,
    ADD COLUMN "complianceObligationId" TEXT,
    ADD COLUMN "rootDocumentId" TEXT,
    ADD COLUMN "previousVersionId" TEXT,
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "latestVersion" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "description" TEXT,
    ADD COLUMN "documentType" TEXT NOT NULL DEFAULT 'OTHER',
    ADD COLUMN "status" "DocumentStorageStatus" NOT NULL DEFAULT 'PENDING_SCAN',
    ADD COLUMN "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
    ADD COLUMN "uploadedByUserId" TEXT NOT NULL DEFAULT 'legacy-unattributed',
    ADD COLUMN "reviewedByUserId" TEXT,
    ADD COLUMN "reviewedAt" TIMESTAMP(3),
    ADD COLUMN "reviewNote" TEXT,
    ADD COLUMN "retainUntil" TIMESTAMP(3),
    ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "WorkspaceSettings"
    ADD COLUMN "documentRetentionDays" INTEGER;

UPDATE "Document"
SET "rootDocumentId" = "id",
    "mimeType" = COALESCE("mimeType", 'application/octet-stream'),
    "storageKey" = COALESCE("storageKey", 'legacy-unverified/' || "id"),
    "sizeBytes" = COALESCE("sizeBytes", 0),
    "checksum" = COALESCE("checksum", 'legacy-unverified'),
    "scanStatus" = 'LEGACY_UNVERIFIED';

ALTER TABLE "Document"
    ALTER COLUMN "rootDocumentId" SET NOT NULL,
    ALTER COLUMN "mimeType" SET NOT NULL,
    ALTER COLUMN "storageKey" SET NOT NULL,
    ALTER COLUMN "sizeBytes" SET NOT NULL,
    ALTER COLUMN "checksum" SET NOT NULL,
    ALTER COLUMN "uploadedByUserId" DROP DEFAULT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "ComplianceEvidence" ce
        LEFT JOIN "Document" d ON d."id" = ce."documentId"
        WHERE d."id" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot add ComplianceEvidence document relation: orphan documentId values exist.';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM "Document" d
        JOIN "Client" c ON c."id" = d."clientId"
        WHERE c."workspaceId" <> d."workspaceId"
    ) THEN
        RAISE EXCEPTION 'Cannot add tenant-scoped document/client relation: cross-workspace client links exist.';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Document"
        GROUP BY "storageKey"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add unique document storage keys: duplicate storageKey values exist.';
    END IF;
END $$;

CREATE TABLE "DocumentAccessEvent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAccessEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DocumentAccessEvent_documentId_fkey"
        FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentAccessEvent_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "ComplianceEvidence"
    ADD COLUMN "workspaceId" TEXT;

ALTER TABLE "ComplianceEvidence"
    DROP CONSTRAINT "ComplianceEvidence_obligationId_fkey";

ALTER TABLE "Document"
    DROP CONSTRAINT "Document_clientId_fkey";

DROP INDEX "Document_workspaceId_idx";

UPDATE "ComplianceEvidence" ce
SET "workspaceId" = co."workspaceId"
FROM "ComplianceObligation" co
WHERE ce."obligationId" = co."id";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "ComplianceEvidence" ce
        LEFT JOIN "Document" d ON d."id" = ce."documentId"
        WHERE ce."workspaceId" IS NULL
           OR d."workspaceId" IS DISTINCT FROM ce."workspaceId"
    ) THEN
        RAISE EXCEPTION 'Cannot enforce tenant-scoped compliance evidence: obligation/document workspaces do not match.';
    END IF;
END $$;

ALTER TABLE "ComplianceEvidence"
    ALTER COLUMN "workspaceId" SET NOT NULL;

CREATE UNIQUE INDEX "Client_id_workspaceId_key" ON "Client"("id", "workspaceId");
CREATE UNIQUE INDEX "Engagement_id_workspaceId_key" ON "Engagement"("id", "workspaceId");
CREATE UNIQUE INDEX "ComplianceObligation_id_workspaceId_key" ON "ComplianceObligation"("id", "workspaceId");
CREATE UNIQUE INDEX "Document_id_workspaceId_key" ON "Document"("id", "workspaceId");

ALTER TABLE "Document"
    ADD CONSTRAINT "Document_clientId_workspaceId_fkey"
        FOREIGN KEY ("clientId", "workspaceId") REFERENCES "Client"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "Document_engagementId_workspaceId_fkey"
        FOREIGN KEY ("engagementId", "workspaceId") REFERENCES "Engagement"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "Document_complianceObligationId_workspaceId_fkey"
        FOREIGN KEY ("complianceObligationId", "workspaceId") REFERENCES "ComplianceObligation"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "Document_rootDocumentId_workspaceId_fkey"
        FOREIGN KEY ("rootDocumentId", "workspaceId") REFERENCES "Document"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "Document_previousVersionId_workspaceId_fkey"
        FOREIGN KEY ("previousVersionId", "workspaceId") REFERENCES "Document"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentAccessEvent"
    DROP CONSTRAINT "DocumentAccessEvent_documentId_fkey";

ALTER TABLE "DocumentAccessEvent"
    ADD CONSTRAINT "DocumentAccessEvent_documentId_workspaceId_fkey"
        FOREIGN KEY ("documentId", "workspaceId") REFERENCES "Document"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceEvidence"
    ADD CONSTRAINT "ComplianceEvidence_obligationId_workspaceId_fkey"
        FOREIGN KEY ("obligationId", "workspaceId") REFERENCES "ComplianceObligation"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ComplianceEvidence_documentId_workspaceId_fkey"
        FOREIGN KEY ("documentId", "workspaceId") REFERENCES "Document"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ComplianceEvidence_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");
CREATE UNIQUE INDEX "Document_rootDocumentId_version_key" ON "Document"("rootDocumentId", "version");
CREATE INDEX "Document_workspaceId_status_createdAt_idx" ON "Document"("workspaceId", "status", "createdAt");
CREATE INDEX "Document_engagementId_idx" ON "Document"("engagementId");
CREATE INDEX "Document_complianceObligationId_idx" ON "Document"("complianceObligationId");
CREATE INDEX "Document_retainUntil_deletedAt_idx" ON "Document"("retainUntil", "deletedAt");
CREATE INDEX "DocumentAccessEvent_workspaceId_occurredAt_idx" ON "DocumentAccessEvent"("workspaceId", "occurredAt");
CREATE INDEX "DocumentAccessEvent_documentId_occurredAt_idx" ON "DocumentAccessEvent"("documentId", "occurredAt");
CREATE INDEX "ComplianceEvidence_workspaceId_createdAt_idx" ON "ComplianceEvidence"("workspaceId", "createdAt");
