CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');
ALTER TYPE "OperationalActionEventType" ADD VALUE 'ACTION_SUBMITTED_FOR_REVIEW';

CREATE TABLE "ComplianceNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "obligationId" TEXT,
    "actionId" TEXT,
    "recipientUserId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ComplianceNotification_organizationId_workspaceId_scheduledFor_idx"
    ON "ComplianceNotification"("organizationId", "workspaceId", "scheduledFor");
CREATE INDEX "ComplianceNotification_organizationId_workspaceId_status_idx"
    ON "ComplianceNotification"("organizationId", "workspaceId", "status");
CREATE UNIQUE INDEX "ComplianceNotification_organizationId_workspaceId_dedupeKey_key"
    ON "ComplianceNotification"("organizationId", "workspaceId", "dedupeKey");
CREATE UNIQUE INDEX "OperationalEscalationEvent_actionId_toLevel_key"
    ON "OperationalEscalationEvent"("actionId", "toLevel");
