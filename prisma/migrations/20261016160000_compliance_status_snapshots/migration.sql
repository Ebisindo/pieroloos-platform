-- Append-only status transition history that preserves completion timestamps across reopening.
CREATE TABLE "ComplianceStatusSnapshot" (
  "id" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "previousStatus" "ComplianceStatus" NOT NULL,
  "currentStatus" "ComplianceStatus" NOT NULL,
  "completedAtBefore" TIMESTAMP(3),
  "completedAtAfter" TIMESTAMP(3),
  "reason" TEXT,
  "actorUserId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceStatusSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComplianceStatusSnapshot_sequence_check" CHECK ("sequence" > 0)
);

CREATE UNIQUE INDEX "ComplianceStatusSnapshot_obligationId_sequence_key"
  ON "ComplianceStatusSnapshot"("obligationId", "sequence");
CREATE INDEX "ComplianceStatusSnapshot_workspaceId_occurredAt_idx"
  ON "ComplianceStatusSnapshot"("workspaceId", "occurredAt");
CREATE INDEX "ComplianceStatusSnapshot_obligationId_occurredAt_idx"
  ON "ComplianceStatusSnapshot"("obligationId", "occurredAt");

ALTER TABLE "ComplianceStatusSnapshot"
  ADD CONSTRAINT "ComplianceStatusSnapshot_obligationId_workspaceId_fkey"
  FOREIGN KEY ("obligationId", "workspaceId") REFERENCES "ComplianceObligation"("id", "workspaceId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceStatusSnapshot"
  ADD CONSTRAINT "ComplianceStatusSnapshot_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceStatusSnapshot"
  ADD CONSTRAINT "ComplianceStatusSnapshot_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_compliance_status_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Compliance status snapshots are immutable';
END;
$$;

CREATE TRIGGER "ComplianceStatusSnapshot_immutable"
BEFORE UPDATE OR DELETE ON "ComplianceStatusSnapshot"
FOR EACH ROW EXECUTE FUNCTION prevent_compliance_status_snapshot_mutation();
