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
CREATE INDEX "FirebaseIdentity_auditEventId_idx" ON "FirebaseIdentity"("auditEventId");

ALTER TABLE "FirebaseIdentity"
  ADD CONSTRAINT "FirebaseIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
