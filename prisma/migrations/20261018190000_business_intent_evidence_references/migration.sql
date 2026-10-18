-- Persist the server-resolved evidence records attached to a business-intent proposal.
-- This is an additive, branch-only migration. Do not apply to production without an approved
-- backup, migration review and rollback plan.

CREATE TABLE "BusinessIntentEvidenceReference" (
  "id" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "clientId" TEXT,
  "claimStatement" TEXT NOT NULL,
  "verificationState" TEXT NOT NULL DEFAULT 'SOURCE_VERIFIED_RECORD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessIntentEvidenceReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessIntentEvidenceReference_proposalId_evidenceId_key"
  ON "BusinessIntentEvidenceReference"("proposalId", "evidenceId");
CREATE INDEX "BusinessIntentEvidenceReference_workspaceId_evidenceId_idx"
  ON "BusinessIntentEvidenceReference"("workspaceId", "evidenceId");
CREATE INDEX "BusinessIntentEvidenceReference_clientId_evidenceId_idx"
  ON "BusinessIntentEvidenceReference"("clientId", "evidenceId");

ALTER TABLE "BusinessIntentEvidenceReference"
  ADD CONSTRAINT "BusinessIntentEvidenceReference_proposalId_workspaceId_fkey"
  FOREIGN KEY ("proposalId", "workspaceId")
  REFERENCES "BusinessIntentProposal"("id", "workspaceId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessIntentEvidenceReference"
  ADD CONSTRAINT "BusinessIntentEvidenceReference_documentId_workspaceId_fkey"
  FOREIGN KEY ("documentId", "workspaceId")
  REFERENCES "Document"("id", "workspaceId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessIntentEvidenceReference"
  ADD CONSTRAINT "BusinessIntentEvidenceReference_evidenceId_fkey"
  FOREIGN KEY ("evidenceId")
  REFERENCES "Evidence"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessIntentEvidenceReference"
  ADD CONSTRAINT "BusinessIntentEvidenceReference_workspaceId_fkey"
  FOREIGN KEY ("workspaceId")
  REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessIntentEvidenceReference"
  ADD CONSTRAINT "BusinessIntentEvidenceReference_clientId_workspaceId_fkey"
  FOREIGN KEY ("clientId", "workspaceId")
  REFERENCES "Client"("id", "workspaceId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
