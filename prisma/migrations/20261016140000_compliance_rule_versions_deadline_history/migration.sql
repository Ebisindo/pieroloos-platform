CREATE TYPE "ComplianceRuleReviewState" AS ENUM ('UNREVIEWED', 'VERIFIED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "ComplianceRuleAssessmentState" AS ENUM ('APPLICABLE', 'NOT_APPLICABLE', 'UNKNOWN');

CREATE TABLE "ComplianceRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "jurisdictionId" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceRuleVersion" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "jurisdictionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "obligationType" TEXT NOT NULL,
  "sourceAuthority" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceRetrievedAt" TIMESTAMP(3) NOT NULL,
  "publicationDate" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveThrough" TIMESTAMP(3),
  "evidenceClass" "EvidenceClass" NOT NULL,
  "applicability" JSONB NOT NULL,
  "relativeDueDays" INTEGER,
  "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
  "professionalReviewRequired" BOOLEAN NOT NULL DEFAULT true,
  "reviewState" "ComplianceRuleReviewState" NOT NULL DEFAULT 'UNREVIEWED',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "supersededByVersion" INTEGER,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceRuleVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComplianceRuleVersion_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "ComplianceRuleVersion_effective_range_check" CHECK ("effectiveThrough" IS NULL OR "effectiveThrough" >= "effectiveFrom"),
  CONSTRAINT "ComplianceRuleVersion_reviewer_check" CHECK ("reviewState" <> 'VERIFIED' OR ("reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "evidenceClass" IN ('E3', 'E4')))
);

CREATE TABLE "ComplianceDeadlineSnapshot" (
  "id" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "previousDueAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "sourceRuleVersionId" TEXT,
  "assessmentState" "ComplianceRuleAssessmentState" NOT NULL DEFAULT 'UNKNOWN',
  "assessmentFacts" JSONB NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceDeadlineSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComplianceDeadlineSnapshot_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "ComplianceDeadlineSnapshot_reason_check" CHECK (length(btrim("reason")) >= 4)
);

CREATE UNIQUE INDEX "ComplianceRule_organizationId_workspaceId_ruleKey_key" ON "ComplianceRule"("organizationId", "workspaceId", "ruleKey");
CREATE UNIQUE INDEX "ComplianceRule_id_workspaceId_key" ON "ComplianceRule"("id", "workspaceId");
CREATE INDEX "ComplianceRule_workspaceId_jurisdictionId_active_idx" ON "ComplianceRule"("workspaceId", "jurisdictionId", "active");
CREATE UNIQUE INDEX "ComplianceRuleVersion_ruleId_version_key" ON "ComplianceRuleVersion"("ruleId", "version");
CREATE UNIQUE INDEX "ComplianceRuleVersion_id_workspaceId_key" ON "ComplianceRuleVersion"("id", "workspaceId");
CREATE INDEX "ComplianceRuleVersion_workspaceId_jurisdictionId_reviewState_idx" ON "ComplianceRuleVersion"("workspaceId", "jurisdictionId", "reviewState");
CREATE INDEX "ComplianceRuleVersion_sourceRetrievedAt_effectiveThrough_idx" ON "ComplianceRuleVersion"("sourceRetrievedAt", "effectiveThrough");
CREATE UNIQUE INDEX "ComplianceDeadlineSnapshot_obligationId_sequence_key" ON "ComplianceDeadlineSnapshot"("obligationId", "sequence");
CREATE INDEX "ComplianceDeadlineSnapshot_workspaceId_createdAt_idx" ON "ComplianceDeadlineSnapshot"("workspaceId", "createdAt");
CREATE INDEX "ComplianceDeadlineSnapshot_obligationId_createdAt_idx" ON "ComplianceDeadlineSnapshot"("obligationId", "createdAt");

ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_workspace_fk" FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceRuleVersion" ADD CONSTRAINT "ComplianceRuleVersion_rule_fk" FOREIGN KEY ("ruleId", "workspaceId") REFERENCES "ComplianceRule"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceDeadlineSnapshot" ADD CONSTRAINT "ComplianceDeadlineSnapshot_obligation_fk" FOREIGN KEY ("obligationId", "workspaceId") REFERENCES "ComplianceObligation"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceDeadlineSnapshot" ADD CONSTRAINT "ComplianceDeadlineSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplianceDeadlineSnapshot" ADD CONSTRAINT "ComplianceDeadlineSnapshot_sourceRuleVersionId_fkey" FOREIGN KEY ("sourceRuleVersionId") REFERENCES "ComplianceRuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceDeadlineSnapshot" ADD CONSTRAINT "ComplianceDeadlineSnapshot_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceObligation" ADD COLUMN "sourceRuleVersionId" TEXT;
ALTER TABLE "ComplianceObligation" ADD CONSTRAINT "ComplianceObligation_sourceRuleVersionId_fkey" FOREIGN KEY ("sourceRuleVersionId") REFERENCES "ComplianceRuleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Deadline snapshots are append-only at the database boundary. UPDATE and DELETE are denied to application roles.
CREATE OR REPLACE FUNCTION prevent_compliance_deadline_snapshot_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Compliance deadline snapshots are immutable';
END;
$$;

CREATE TRIGGER "ComplianceDeadlineSnapshot_immutable"
BEFORE UPDATE OR DELETE ON "ComplianceDeadlineSnapshot"
FOR EACH ROW EXECUTE FUNCTION prevent_compliance_deadline_snapshot_mutation();
