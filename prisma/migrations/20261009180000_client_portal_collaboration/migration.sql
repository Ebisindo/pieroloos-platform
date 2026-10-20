CREATE TYPE "ClientPortalInteractionKind" AS ENUM (
  'MESSAGE',
  'COMPLETION_SUBMISSION',
  'ACKNOWLEDGMENT_REQUEST',
  'ACKNOWLEDGMENT'
);

CREATE TYPE "ClientPortalInteractionStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'CHANGES_REQUESTED',
  'ACKNOWLEDGED'
);

CREATE TABLE "ClientPortalInteraction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "grantId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "kind" "ClientPortalInteractionKind" NOT NULL,
  "status" "ClientPortalInteractionStatus",
  "resourceType" TEXT,
  "resourceId" TEXT,
  "parentInteractionId" TEXT,
  "body" TEXT NOT NULL,
  "contentHash" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientPortalInteraction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientPortalInteraction_organizationId_workspaceId_clientId_createdAt_idx"
  ON "ClientPortalInteraction"("organizationId", "workspaceId", "clientId", "createdAt");
CREATE INDEX "ClientPortalInteraction_clientId_resourceType_resourceId_createdAt_idx"
  ON "ClientPortalInteraction"("clientId", "resourceType", "resourceId", "createdAt");
CREATE INDEX "ClientPortalInteraction_parentInteractionId_createdAt_idx"
  ON "ClientPortalInteraction"("parentInteractionId", "createdAt");
CREATE INDEX "ClientPortalInteraction_kind_status_createdAt_idx"
  ON "ClientPortalInteraction"("kind", "status", "createdAt");

ALTER TABLE "ClientPortalInteraction"
  ADD CONSTRAINT "ClientPortalInteraction_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalInteraction"
  ADD CONSTRAINT "ClientPortalInteraction_organizationId_workspaceId_fkey"
  FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalInteraction"
  ADD CONSTRAINT "ClientPortalInteraction_clientId_workspaceId_fkey"
  FOREIGN KEY ("clientId", "workspaceId") REFERENCES "Client"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPortalInteraction"
  ADD CONSTRAINT "ClientPortalInteraction_grantId_fkey"
  FOREIGN KEY ("grantId") REFERENCES "ClientPortalGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPortalInteraction"
  ADD CONSTRAINT "ClientPortalInteraction_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientPortalInteraction"
  ADD CONSTRAINT "ClientPortalInteraction_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientPortalInteraction"
  ADD CONSTRAINT "ClientPortalInteraction_parentInteractionId_fkey"
  FOREIGN KEY ("parentInteractionId") REFERENCES "ClientPortalInteraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_client_portal_acknowledgment_update() RETURNS trigger AS $$
BEGIN
  IF OLD."kind" = 'ACKNOWLEDGMENT'::"ClientPortalInteractionKind" THEN
    RAISE EXCEPTION 'Client portal acknowledgment records are immutable.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ClientPortalAcknowledgment_immutable"
  BEFORE UPDATE ON "ClientPortalInteraction"
  FOR EACH ROW EXECUTE FUNCTION prevent_client_portal_acknowledgment_update();
