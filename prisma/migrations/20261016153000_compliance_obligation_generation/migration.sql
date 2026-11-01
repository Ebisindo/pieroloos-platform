-- Add a scoped idempotency key for obligations generated from reviewed rule versions.
-- Manual and legacy obligations keep NULL; PostgreSQL unique indexes allow multiple NULL values.
ALTER TABLE "ComplianceObligation"
  ADD COLUMN "generationKey" TEXT;

CREATE UNIQUE INDEX "ComplianceObligation_workspace_generationKey_key"
  ON "ComplianceObligation" ("workspaceId", "generationKey");
