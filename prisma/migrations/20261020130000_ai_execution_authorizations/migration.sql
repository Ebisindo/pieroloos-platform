CREATE TYPE "AIExecutionAuthorizationStatus" AS ENUM (
  'AUTHORIZED',
  'CONSUMED',
  'REVOKED',
  'EXPIRED'
);

CREATE TYPE "AIExecutionOperationType" AS ENUM (
  'CORPORATE_GRAPH_MUTATION',
  'FILING_SUBMISSION',
  'PAYMENT',
  'PRIVILEGE_CHANGE'
);

CREATE TABLE "AIExecutionAuthorization" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "proposalVersion" INTEGER NOT NULL,
  "operationType" "AIExecutionOperationType" NOT NULL,
  "operationDigest" TEXT NOT NULL,
  "operationSnapshot" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "AIExecutionAuthorizationStatus" NOT NULL DEFAULT 'AUTHORIZED',
  "authorizedByUserId" TEXT NOT NULL,
  "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "consumedByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIExecutionAuthorization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AIExecutionAuthorization_version_positive" CHECK ("proposalVersion" > 0),
  CONSTRAINT "AIExecutionAuthorization_digest_sha256" CHECK ("operationDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "AIExecutionAuthorization_expiry_after_authorization" CHECK ("expiresAt" > "authorizedAt")
);

CREATE UNIQUE INDEX "AIExecutionAuthorization_id_workspace_key"
  ON "AIExecutionAuthorization"("id", "workspaceId");
CREATE UNIQUE INDEX "AIExecutionAuthorization_workspace_idempotency_key"
  ON "AIExecutionAuthorization"("workspaceId", "idempotencyKey");
CREATE INDEX "AIExecutionAuthorization_tenant_status_expiry_idx"
  ON "AIExecutionAuthorization"("organizationId", "workspaceId", "status", "expiresAt");
CREATE INDEX "AIExecutionAuthorization_proposal_version_digest_idx"
  ON "AIExecutionAuthorization"("proposalId", "proposalVersion", "operationDigest");

ALTER TABLE "AIExecutionAuthorization"
  ADD CONSTRAINT "AIExecutionAuthorization_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIExecutionAuthorization"
  ADD CONSTRAINT "AIExecutionAuthorization_organizationId_workspaceId_fkey"
  FOREIGN KEY ("organizationId", "workspaceId")
  REFERENCES "Workspace"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIExecutionAuthorization"
  ADD CONSTRAINT "AIExecutionAuthorization_proposalId_workspaceId_fkey"
  FOREIGN KEY ("proposalId", "workspaceId")
  REFERENCES "BusinessIntentProposal"("id", "workspaceId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AIExecutionAuthorization"
  ADD CONSTRAINT "AIExecutionAuthorization_authorizedByUserId_fkey"
  FOREIGN KEY ("authorizedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AIExecutionAuthorization"
  ADD CONSTRAINT "AIExecutionAuthorization_consumedByUserId_fkey"
  FOREIGN KEY ("consumedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
