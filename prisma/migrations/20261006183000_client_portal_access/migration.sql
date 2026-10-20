ALTER TABLE "Task" ADD COLUMN "portalVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FormationTask" ADD COLUMN "portalVisible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ComplianceObligation" ADD COLUMN "portalVisible" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ClientPortalGrant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "canViewStatus" BOOLEAN NOT NULL DEFAULT true,
    "canViewTasks" BOOLEAN NOT NULL DEFAULT true,
    "canUploadEvidence" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientPortalGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientPortalAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "grantId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientPortalAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPortalGrant_clientId_userId_key" ON "ClientPortalGrant"("clientId", "userId");
CREATE INDEX "ClientPortalGrant_userId_revokedAt_expiresAt_idx" ON "ClientPortalGrant"("userId", "revokedAt", "expiresAt");
CREATE INDEX "ClientPortalGrant_organizationId_workspaceId_clientId_revokedAt_idx" ON "ClientPortalGrant"("organizationId", "workspaceId", "clientId", "revokedAt");
CREATE INDEX "ClientPortalAuditEvent_organizationId_workspaceId_occurredAt_idx" ON "ClientPortalAuditEvent"("organizationId", "workspaceId", "occurredAt");
CREATE INDEX "ClientPortalAuditEvent_clientId_occurredAt_idx" ON "ClientPortalAuditEvent"("clientId", "occurredAt");
CREATE INDEX "ClientPortalAuditEvent_actorUserId_occurredAt_idx" ON "ClientPortalAuditEvent"("actorUserId", "occurredAt");

ALTER TABLE "ClientPortalGrant"
    ADD CONSTRAINT "ClientPortalGrant_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalGrant"
    ADD CONSTRAINT "ClientPortalGrant_organizationId_workspaceId_fkey"
    FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalGrant"
    ADD CONSTRAINT "ClientPortalGrant_clientId_workspaceId_fkey"
    FOREIGN KEY ("clientId", "workspaceId") REFERENCES "Client"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalGrant"
    ADD CONSTRAINT "ClientPortalGrant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalGrant"
    ADD CONSTRAINT "ClientPortalGrant_grantedByUserId_fkey"
    FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientPortalAuditEvent"
    ADD CONSTRAINT "ClientPortalAuditEvent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalAuditEvent"
    ADD CONSTRAINT "ClientPortalAuditEvent_organizationId_workspaceId_fkey"
    FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalAuditEvent"
    ADD CONSTRAINT "ClientPortalAuditEvent_clientId_workspaceId_fkey"
    FOREIGN KEY ("clientId", "workspaceId") REFERENCES "Client"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalAuditEvent"
    ADD CONSTRAINT "ClientPortalAuditEvent_grantId_fkey"
    FOREIGN KEY ("grantId") REFERENCES "ClientPortalGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPortalAuditEvent"
    ADD CONSTRAINT "ClientPortalAuditEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
