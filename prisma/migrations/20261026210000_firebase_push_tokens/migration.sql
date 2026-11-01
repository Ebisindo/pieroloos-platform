ALTER TYPE "NotificationChannel" ADD VALUE 'PUSH';

ALTER TABLE "NotificationPreference"
  ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "FirebasePushToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "FirebasePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FirebasePushToken_token_key" ON "FirebasePushToken"("token");
CREATE INDEX "FirebasePushToken_userId_revokedAt_idx" ON "FirebasePushToken"("userId", "revokedAt");
ALTER TABLE "FirebasePushToken"
  ADD CONSTRAINT "FirebasePushToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
