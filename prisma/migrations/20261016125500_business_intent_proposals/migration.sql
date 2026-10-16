CREATE TYPE "BusinessIntentProposalStatus" AS ENUM (
  'PROPOSED',
  'REVIEW_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED'
);

CREATE TYPE "BusinessIntentReviewDecision" AS ENUM (
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED'
);

CREATE TABLE "BusinessIntentProposal" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "status" "BusinessIntentProposalStatus" NOT NULL DEFAULT 'PROPOSED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "inputDigest" TEXT NOT NULL,
  "proposal" JSONB NOT NULL,
  "evidenceReferences" JSONB,
  "provider" TEXT,
  "providerModel" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessIntentProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessIntentProposal_id_workspace_key"
  ON "BusinessIntentProposal"("id", "workspaceId");
CREATE INDEX "BusinessIntentProposal_tenant_status_created_idx"
  ON "BusinessIntentProposal"("organizationId", "workspaceId", "status", "createdAt");
CREATE INDEX "BusinessIntentProposal_client_created_idx"
  ON "BusinessIntentProposal"("clientId", "createdAt");

ALTER TABLE "BusinessIntentProposal"
  ADD CONSTRAINT "BusinessIntentProposal_organizationId_workspaceId_fkey"
  FOREIGN KEY ("organizationId", "workspaceId")
  REFERENCES "Workspace"("organizationId", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessIntentProposal"
  ADD CONSTRAINT "BusinessIntentProposal_clientId_workspaceId_fkey"
  FOREIGN KEY ("clientId", "workspaceId")
  REFERENCES "Client"("id", "workspaceId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessIntentProposal"
  ADD CONSTRAINT "BusinessIntentProposal_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessIntentProposal"
  ADD CONSTRAINT "BusinessIntentProposal_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "BusinessIntentProposalReview" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "decision" "BusinessIntentReviewDecision" NOT NULL,
  "note" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessIntentProposalReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessIntentProposalReview_workspace_proposal_time_idx"
  ON "BusinessIntentProposalReview"("workspaceId", "proposalId", "occurredAt");

ALTER TABLE "BusinessIntentProposalReview"
  ADD CONSTRAINT "BusinessIntentProposalReview_proposalId_workspaceId_fkey"
  FOREIGN KEY ("proposalId", "workspaceId")
  REFERENCES "BusinessIntentProposal"("id", "workspaceId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessIntentProposalReview"
  ADD CONSTRAINT "BusinessIntentProposalReview_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
