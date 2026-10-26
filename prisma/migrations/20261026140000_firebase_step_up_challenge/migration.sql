CREATE TABLE "FirebaseStepUpChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "firebaseUid" TEXT NOT NULL,
  "handleHash" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "sessionHash" TEXT NOT NULL,
  "authTime" TIMESTAMP(3),
  "secondFactor" TEXT,
  "proofHash" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FirebaseStepUpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FirebaseStepUpChallenge_handleHash_key" ON "FirebaseStepUpChallenge"("handleHash");
CREATE UNIQUE INDEX "FirebaseStepUpChallenge_proofHash_key" ON "FirebaseStepUpChallenge"("proofHash");
CREATE INDEX "FirebaseStepUpChallenge_userId_operation_expiresAt_idx" ON "FirebaseStepUpChallenge"("userId", "operation", "expiresAt");
CREATE INDEX "FirebaseStepUpChallenge_expiresAt_consumedAt_idx" ON "FirebaseStepUpChallenge"("expiresAt", "consumedAt");

ALTER TABLE "FirebaseStepUpChallenge"
  ADD CONSTRAINT "FirebaseStepUpChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
