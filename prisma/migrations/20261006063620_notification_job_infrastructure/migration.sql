ALTER TYPE "NotificationStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "NotificationStatus" ADD VALUE 'DEAD_LETTER';
CREATE TYPE "NotificationAttemptStatus" AS ENUM ('ATTEMPTING', 'ACCEPTED', 'RETRYABLE_FAILURE', 'PERMANENT_FAILURE');

ALTER TABLE "ComplianceNotification"
    ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
    ADD COLUMN "lockedAt" TIMESTAMP(3),
    ADD COLUMN "lockedBy" TEXT,
    ADD COLUMN "providerMessageId" TEXT,
    ADD COLUMN "deliveryReceipt" TEXT,
    ADD COLUMN "templateKey" TEXT NOT NULL DEFAULT 'legacy-notification',
    ADD COLUMN "templateVersion" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "deadLetteredAt" TIMESTAMP(3);

CREATE INDEX "ComplianceNotification_status_scheduledFor_nextAttemptAt_lo_idx"
    ON "ComplianceNotification"("status", "scheduledFor", "nextAttemptAt", "lockedAt");

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "ComplianceNotification" notification
        LEFT JOIN "Workspace" workspace
          ON workspace."organizationId" = notification."organizationId"
         AND workspace."id" = notification."workspaceId"
        WHERE workspace."id" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot add notification workspace constraint: existing notifications have invalid tenant scope.';
    END IF;
END $$;

CREATE UNIQUE INDEX "Workspace_organizationId_id_key"
    ON "Workspace"("organizationId", "id");
ALTER TABLE "ComplianceNotification"
    ADD CONSTRAINT "ComplianceNotification_organizationId_workspaceId_fkey"
    FOREIGN KEY ("organizationId", "workspaceId")
    REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_workspaceId_userId_key"
    ON "NotificationPreference"("workspaceId", "userId");
CREATE INDEX "NotificationPreference_userId_idx"
    ON "NotificationPreference"("userId");
ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "NotificationAttemptStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,

    CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDeliveryAttempt_notificationId_attemptNumber_key"
    ON "NotificationDeliveryAttempt"("notificationId", "attemptNumber");
CREATE INDEX "NotificationDeliveryAttempt_status_startedAt_idx"
    ON "NotificationDeliveryAttempt"("status", "startedAt");
ALTER TABLE "NotificationDeliveryAttempt"
    ADD CONSTRAINT "NotificationDeliveryAttempt_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "ComplianceNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
