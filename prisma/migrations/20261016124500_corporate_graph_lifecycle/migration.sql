ALTER TABLE "CorporateGraphNode"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedByUserId" TEXT;

ALTER TABLE "CorporateGraphEdge"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedByUserId" TEXT;

CREATE TYPE "CorporateGraphAuditAction" AS ENUM (
  'NODE_CREATED',
  'NODE_UPDATED',
  'NODE_ARCHIVED',
  'EDGE_CREATED',
  'EDGE_ARCHIVED'
);

CREATE TABLE "CorporateGraphAuditEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" "CorporateGraphAuditAction" NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CorporateGraphAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CorporateGraphAuditEvent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CorporateGraphAuditEvent_organizationId_workspaceId_fkey"
    FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CorporateGraphAuditEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CorporateGraphAuditEvent_organizationId_workspaceId_occurredAt_idx"
  ON "CorporateGraphAuditEvent"("organizationId", "workspaceId", "occurredAt");
CREATE INDEX "CorporateGraphAuditEvent_subjectType_subjectId_occurredAt_idx"
  ON "CorporateGraphAuditEvent"("subjectType", "subjectId", "occurredAt");
CREATE INDEX "CorporateGraphNode_workspace_archivedAt_idx"
  ON "CorporateGraphNode"("organizationId", "workspaceId", "archivedAt");
CREATE INDEX "CorporateGraphEdge_workspace_archivedAt_idx"
  ON "CorporateGraphEdge"("organizationId", "workspaceId", "archivedAt");
