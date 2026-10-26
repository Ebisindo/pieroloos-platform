CREATE TABLE "FirebaseIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "firebaseUid" TEXT NOT NULL,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linkedByUserId" TEXT NOT NULL,
  "auditEventId" TEXT NOT NULL,
  CONSTRAINT "FirebaseIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FirebaseIdentity_userId_key" ON "FirebaseIdentity"("userId");
CREATE UNIQUE INDEX "FirebaseIdentity_projectId_firebaseUid_key" ON "FirebaseIdentity"("projectId", "firebaseUid");
CREATE INDEX "FirebaseIdentity_linkedByUserId_linkedAt_idx" ON "FirebaseIdentity"("linkedByUserId", "linkedAt");
CREATE UNIQUE INDEX "FirebaseIdentity_auditEventId_key" ON "FirebaseIdentity"("auditEventId");

ALTER TABLE "FirebaseIdentity"
  ADD CONSTRAINT "FirebaseIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FirebaseIdentity"
  ADD CONSTRAINT "FirebaseIdentity_linkedByUserId_fkey"
  FOREIGN KEY ("linkedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FirebaseIdentity"
  ADD CONSTRAINT "FirebaseIdentity_auditEventId_fkey"
  FOREIGN KEY ("auditEventId") REFERENCES "PlatformAuditEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
