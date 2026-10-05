CREATE TYPE "MarketEntryStatus" AS ENUM ('ASSESSING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED');
CREATE TYPE "MarketEntryReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

CREATE TABLE "MarketEntryPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "comparisonSnapshotId" TEXT NOT NULL,
    "targetJurisdictionId" TEXT NOT NULL,
    "formationPlanId" TEXT,
    "workingJurisdictionDecisionId" TEXT,
    "rationale" TEXT NOT NULL,
    "status" "MarketEntryStatus" NOT NULL DEFAULT 'ASSESSING',
    "reviewStatus" "MarketEntryReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedAssessmentVersion" INTEGER,
    "createdByUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketEntryPlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarketEntryPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketEntryPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MarketEntryPlan_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketEntryPlan_comparisonSnapshotId_fkey" FOREIGN KEY ("comparisonSnapshotId") REFERENCES "JurisdictionComparison"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketEntryPlan_targetJurisdictionId_fkey" FOREIGN KEY ("targetJurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketEntryPlan_formationPlanId_fkey" FOREIGN KEY ("formationPlanId") REFERENCES "FormationPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MarketEntryPlan_workingJurisdictionDecisionId_fkey" FOREIGN KEY ("workingJurisdictionDecisionId") REFERENCES "WorkingJurisdictionDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "MarketEntryAuditEvent" (
    "id" TEXT NOT NULL,
    "marketEntryPlanId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "details" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketEntryAuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarketEntryAuditEvent_marketEntryPlanId_fkey" FOREIGN KEY ("marketEntryPlanId") REFERENCES "MarketEntryPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "MarketReadinessAssessment" (
    "id" TEXT NOT NULL,
    "marketEntryPlanId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "assessedByUserId" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketReadinessAssessment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarketReadinessAssessment_marketEntryPlanId_fkey" FOREIGN KEY ("marketEntryPlanId") REFERENCES "MarketEntryPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MarketReadinessAssessment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "MarketEntryPlan_workspaceId_status_updatedAt_idx" ON "MarketEntryPlan"("workspaceId", "status", "updatedAt");
CREATE INDEX "MarketEntryPlan_businessProfileId_updatedAt_idx" ON "MarketEntryPlan"("businessProfileId", "updatedAt");
CREATE INDEX "MarketEntryPlan_targetJurisdictionId_status_idx" ON "MarketEntryPlan"("targetJurisdictionId", "status");
CREATE INDEX "MarketEntryAuditEvent_workspaceId_occurredAt_idx" ON "MarketEntryAuditEvent"("workspaceId", "occurredAt");
CREATE INDEX "MarketEntryAuditEvent_marketEntryPlanId_occurredAt_idx" ON "MarketEntryAuditEvent"("marketEntryPlanId", "occurredAt");
CREATE INDEX "MarketReadinessAssessment_workspaceId_assessedAt_idx" ON "MarketReadinessAssessment"("workspaceId", "assessedAt");
CREATE INDEX "MarketReadinessAssessment_marketEntryPlanId_assessedAt_idx" ON "MarketReadinessAssessment"("marketEntryPlanId", "assessedAt");
