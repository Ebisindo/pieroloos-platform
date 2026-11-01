CREATE TYPE "SuccessorStatus" AS ENUM ('PENDING', 'ACCEPTED', 'ACTIVE', 'REVOKED');
CREATE TYPE "SuccessorVerificationLevel" AS ENUM ('EMAIL_INVITE', 'ID_VERIFIED');
CREATE TYPE "ContinuityCaseStatus" AS ENUM ('WARNING_SENT', 'REVIEW_REQUIRED', 'ACTIVATED', 'CANCELLED', 'CLOSED');

CREATE TABLE "Successor" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "successorEmail" TEXT NOT NULL,
  "successorName" TEXT NOT NULL,
  "successorGithub" TEXT,
  "relationship" TEXT NOT NULL,
  "status" "SuccessorStatus" NOT NULL DEFAULT 'PENDING',
  "verificationLevel" "SuccessorVerificationLevel" NOT NULL DEFAULT 'EMAIL_INVITE',
  "autoActivateAfterDays" INTEGER NOT NULL DEFAULT 60,
  "permissions" JSONB NOT NULL,
  "inviteTokenHash" TEXT,
  "inviteExpiresAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "idVerifiedAt" TIMESTAMP(3),
  "mfaVerifiedAt" TIMESTAMP(3),
  "highPermissionVerificationNote" TEXT,
  "lastOwnerActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "warningSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Successor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Successor_autoActivateAfterDays_check" CHECK ("autoActivateAfterDays" IN (30, 60, 90))
);

CREATE TABLE "BusinessContinuityCase" (
  "id" TEXT NOT NULL,
  "successorId" TEXT NOT NULL,
  "status" "ContinuityCaseStatus" NOT NULL DEFAULT 'WARNING_SENT',
  "inactivityStartedAt" TIMESTAMP(3) NOT NULL,
  "warningSentAt" TIMESTAMP(3),
  "reviewRequiredAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessContinuityCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContinuityAsset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "recoveryLocation" TEXT NOT NULL,
  "criticality" TEXT NOT NULL DEFAULT 'HIGH',
  "notes" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContinuityAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContinuityRunbook" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContinuityRunbook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContinuityTransmissionPackage" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "encryptedOwnerNote" TEXT,
  "encryptionKeyRef" TEXT,
  "encryptionAlgorithm" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "ContinuityTransmissionPackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Successor_inviteTokenHash_key" ON "Successor"("inviteTokenHash");
CREATE INDEX "Successor_ownerId_status_idx" ON "Successor"("ownerId", "status");
CREATE INDEX "Successor_status_lastOwnerActivityAt_idx" ON "Successor"("status", "lastOwnerActivityAt");
CREATE INDEX "BusinessContinuityCase_successorId_status_idx" ON "BusinessContinuityCase"("successorId", "status");
CREATE INDEX "BusinessContinuityCase_status_updatedAt_idx" ON "BusinessContinuityCase"("status", "updatedAt");
CREATE INDEX "ContinuityAsset_ownerId_assetType_idx" ON "ContinuityAsset"("ownerId", "assetType");
CREATE INDEX "ContinuityRunbook_ownerId_updatedAt_idx" ON "ContinuityRunbook"("ownerId", "updatedAt");
CREATE UNIQUE INDEX "ContinuityTransmissionPackage_caseId_key" ON "ContinuityTransmissionPackage"("caseId");

ALTER TABLE "Successor" ADD CONSTRAINT "Successor_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessContinuityCase" ADD CONSTRAINT "BusinessContinuityCase_successorId_fkey"
  FOREIGN KEY ("successorId") REFERENCES "Successor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContinuityAsset" ADD CONSTRAINT "ContinuityAsset_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContinuityRunbook" ADD CONSTRAINT "ContinuityRunbook_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContinuityTransmissionPackage" ADD CONSTRAINT "ContinuityTransmissionPackage_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "BusinessContinuityCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
