CREATE TABLE "FirebaseIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "firebaseUid" TEXT NOT NULL,
  "linkedByUserId" TEXT NOT NULL,
  "auditEventId" TEXT NOT NULL,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FirebaseIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FirebaseIdentity_auditEventId_key" ON "FirebaseIdentity"("auditEventId");
CREATE UNIQUE INDEX "FirebaseIdentity_userId_projectId_key" ON "FirebaseIdentity"("userId", "projectId");
CREATE UNIQUE INDEX "FirebaseIdentity_projectId_firebaseUid_key" ON "FirebaseIdentity"("projectId", "firebaseUid");
CREATE INDEX "FirebaseIdentity_linkedByUserId_linkedAt_idx" ON "FirebaseIdentity"("linkedByUserId", "linkedAt");

ALTER TABLE "FirebaseStepUpChallenge" ADD COLUMN "firebaseIdentityId" TEXT NOT NULL;

ALTER TABLE "FirebaseIdentity"
  ADD CONSTRAINT "FirebaseIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FirebaseIdentity"
  ADD CONSTRAINT "FirebaseIdentity_linkedByUserId_fkey"
  FOREIGN KEY ("linkedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FirebaseIdentity"
  ADD CONSTRAINT "FirebaseIdentity_auditEventId_fkey"
  FOREIGN KEY ("auditEventId") REFERENCES "PlatformAuditEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FirebaseStepUpChallenge"
  ADD CONSTRAINT "FirebaseStepUpChallenge_firebaseIdentityId_fkey"
  FOREIGN KEY ("firebaseIdentityId") REFERENCES "FirebaseIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
