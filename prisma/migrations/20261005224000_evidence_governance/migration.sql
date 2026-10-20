-- Add provenance, freshness, and reviewer state to linked obligation evidence.
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('PENDING', 'VERIFIED', 'CHANGES_REQUESTED');

ALTER TABLE "ComplianceEvidence"
    ADD COLUMN "sourceReference" TEXT,
    ADD COLUMN "validThrough" TIMESTAMP(3),
    ADD COLUMN "reviewStatus" "EvidenceReviewStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "reviewNote" TEXT,
    ADD COLUMN "reviewedByUserId" TEXT,
    ADD COLUMN "reviewedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "ComplianceEvidence_obligationId_idx";
CREATE INDEX "ComplianceEvidence_obligationId_reviewStatus_validThrough_idx"
    ON "ComplianceEvidence"("obligationId", "reviewStatus", "validThrough");
