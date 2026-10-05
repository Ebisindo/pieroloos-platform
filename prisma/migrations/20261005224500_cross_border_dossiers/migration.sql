-- Persist internal cross-border preparation dossiers, controls, evidence links, and review events.
CREATE TYPE "CrossBorderDossierStatus" AS ENUM ('PREPARING', 'REVIEWED', 'CHANGES_REQUESTED', 'ARCHIVED');
CREATE TYPE "CrossBorderControlStatus" AS ENUM ('NOT_ASSESSED', 'IN_PROGRESS', 'COMPLETE', 'NOT_APPLICABLE');

CREATE TABLE "CrossBorderDossier" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "marketEntryPlanId" TEXT,
    "originJurisdictionId" TEXT NOT NULL,
    "destinationJurisdictionId" TEXT NOT NULL,
    "counterpartyName" TEXT NOT NULL,
    "counterpartyCountry" TEXT,
    "activityDescription" TEXT NOT NULL,
    "currencyCode" TEXT,
    "estimatedValue" DECIMAL(18,2),
    "status" "CrossBorderDossierStatus" NOT NULL DEFAULT 'PREPARING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrossBorderDossier_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CrossBorderDossier_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrossBorderDossier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrossBorderDossier_marketEntryPlanId_fkey" FOREIGN KEY ("marketEntryPlanId") REFERENCES "MarketEntryPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CrossBorderDossier_originJurisdictionId_fkey" FOREIGN KEY ("originJurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrossBorderDossier_destinationJurisdictionId_fkey" FOREIGN KEY ("destinationJurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CrossBorderDossierControl" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrossBorderControlStatus" NOT NULL DEFAULT 'NOT_ASSESSED',
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrossBorderDossierControl_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CrossBorderDossierControl_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "CrossBorderDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CrossBorderControlEvidence" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "linkedByUserId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrossBorderControlEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CrossBorderControlEvidence_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "CrossBorderDossierControl"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrossBorderControlEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CrossBorderDossierAuditEvent" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "details" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrossBorderDossierAuditEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CrossBorderDossierAuditEvent_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "CrossBorderDossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CrossBorderDossier_workspaceId_status_updatedAt_idx" ON "CrossBorderDossier"("workspaceId", "status", "updatedAt");
CREATE INDEX "CrossBorderDossier_clientId_createdAt_idx" ON "CrossBorderDossier"("clientId", "createdAt");
CREATE INDEX "CrossBorderDossier_originJurisdictionId_destinationJurisdic_idx" ON "CrossBorderDossier"("originJurisdictionId", "destinationJurisdictionId");
CREATE INDEX "CrossBorderDossierControl_dossierId_status_idx" ON "CrossBorderDossierControl"("dossierId", "status");
CREATE UNIQUE INDEX "CrossBorderControlEvidence_controlId_documentId_key" ON "CrossBorderControlEvidence"("controlId", "documentId");
CREATE INDEX "CrossBorderControlEvidence_documentId_idx" ON "CrossBorderControlEvidence"("documentId");
CREATE INDEX "CrossBorderDossierAuditEvent_workspaceId_occurredAt_idx" ON "CrossBorderDossierAuditEvent"("workspaceId", "occurredAt");
CREATE INDEX "CrossBorderDossierAuditEvent_dossierId_occurredAt_idx" ON "CrossBorderDossierAuditEvent"("dossierId", "occurredAt");
