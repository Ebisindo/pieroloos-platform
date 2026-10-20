CREATE TYPE "OperationalActionStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'PENDING_REVIEW', 'RESOLVED', 'CANCELLED');
CREATE TYPE "OperationalActionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "OperationalActionEventType" AS ENUM ('CREATED_FROM_SIGNAL', 'ACTION_CREATED', 'ACTION_ASSIGNED', 'ACTION_STARTED', 'ACTION_BLOCKED', 'ACTION_RESOLVED', 'ACTION_ESCALATED', 'ACTION_CANCELLED');

CREATE TABLE "OperationalAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceSignalId" TEXT,
    "clientId" TEXT,
    "engagementId" TEXT,
    "documentId" TEXT,
    "complianceObligationId" TEXT,
    "assigneeUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "priority" "OperationalActionPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "OperationalActionStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "escalationAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalActionAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" "OperationalActionEventType" NOT NULL,
    "details" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalActionAuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OperationalActionAuditEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "OperationalAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "OperationalEscalationEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "fromLevel" INTEGER NOT NULL,
    "toLevel" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalEscalationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationalAction_organizationId_workspaceId_status_idx" ON "OperationalAction"("organizationId", "workspaceId", "status");
CREATE INDEX "OperationalAction_organizationId_workspaceId_dueAt_idx" ON "OperationalAction"("organizationId", "workspaceId", "dueAt");
CREATE INDEX "OperationalAction_assigneeUserId_status_dueAt_idx" ON "OperationalAction"("assigneeUserId", "status", "dueAt");
CREATE INDEX "OperationalAction_sourceSignalId_idx" ON "OperationalAction"("sourceSignalId");
CREATE INDEX "OperationalAction_complianceObligationId_status_idx" ON "OperationalAction"("complianceObligationId", "status");
CREATE UNIQUE INDEX "OperationalAction_organizationId_workspaceId_sourceSignalId_key" ON "OperationalAction"("organizationId", "workspaceId", "sourceSignalId");
CREATE INDEX "OperationalActionAuditEvent_organizationId_workspaceId_occurredAt_idx" ON "OperationalActionAuditEvent"("organizationId", "workspaceId", "occurredAt");
CREATE INDEX "OperationalActionAuditEvent_actionId_occurredAt_idx" ON "OperationalActionAuditEvent"("actionId", "occurredAt");
CREATE INDEX "OperationalEscalationEvent_organizationId_workspaceId_occurredAt_idx" ON "OperationalEscalationEvent"("organizationId", "workspaceId", "occurredAt");
CREATE INDEX "OperationalEscalationEvent_actionId_occurredAt_idx" ON "OperationalEscalationEvent"("actionId", "occurredAt");