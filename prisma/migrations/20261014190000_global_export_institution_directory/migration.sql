-- Country-agnostic export institution directory and evidence-backed partnership lifecycle.
CREATE TYPE "ExportInstitutionCategory" AS ENUM (
  'NATIONAL_EXPORT_PROMOTION',
  'TRADE_MINISTRY',
  'EXPORT_DEVELOPMENT',
  'INTERNATIONAL_TRADE_DEPARTMENT',
  'INVESTMENT_TRADE_PROMOTION',
  'CHAMBER_INDUSTRY_ORGANIZATION',
  'REGIONAL_TRADE_BODY',
  'MULTILATERAL_TRADE_SUPPORT',
  'OTHER'
);

CREATE TYPE "ExportInstitutionScope" AS ENUM (
  'SUBNATIONAL', 'NATIONAL', 'REGIONAL', 'MULTILATERAL', 'INTERNATIONAL', 'OTHER'
);

CREATE TYPE "ExportInstitutionRelationshipStatus" AS ENUM (
  'PROSPECTIVE_NOT_CONFIRMED',
  'RESEARCHING',
  'RESEARCHED',
  'CONCEPT_PREPARED',
  'INTERNAL_REVIEW',
  'OUTREACH_AUTHORIZED',
  'CONTACTED',
  'DISCOVERY_DISCUSSIONS',
  'DUE_DILIGENCE',
  'DRAFT_TERMS',
  'WRITTEN_AUTHORIZATION_VERIFIED',
  'ACTIVE_UNDER_SIGNED_AGREEMENT',
  'PAUSED',
  'DECLINED',
  'CLOSED'
);

CREATE TYPE "ExportInstitutionVerificationStatus" AS ENUM (
  'UNVERIFIED', 'RESEARCH_IN_PROGRESS', 'SOURCE_REVIEWED', 'CROSS_VERIFIED'
);

CREATE TYPE "ExportInstitutionEvidenceClass" AS ENUM (
  'OFFICIAL_PRIMARY', 'WRITTEN_AUTHORIZATION', 'SECONDARY', 'USER_PROVIDED', 'INTERNAL_ASSESSMENT', 'OTHER'
);

CREATE TABLE "ExportInstitution" (
  "id" TEXT NOT NULL,
  "officialName" TEXT NOT NULL,
  "acronym" TEXT,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "category" "ExportInstitutionCategory" NOT NULL,
  "scope" "ExportInstitutionScope" NOT NULL DEFAULT 'NATIONAL',
  "countryCode" TEXT,
  "jurisdictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "officialWebsite" TEXT,
  "publicContactChannels" JSONB,
  "mandateSummary" TEXT,
  "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "collaborationAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "relationshipStatus" "ExportInstitutionRelationshipStatus" NOT NULL DEFAULT 'PROSPECTIVE_NOT_CONFIRMED',
  "verificationStatus" "ExportInstitutionVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "internalOwnerUserId" TEXT,
  "publicProfileApproved" BOOLEAN NOT NULL DEFAULT false,
  "logoUseAuthorized" BOOLEAN NOT NULL DEFAULT false,
  "agreementEvidenceRef" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExportInstitution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExportInstitution_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ExportInstitution_internalOwnerUserId_fkey" FOREIGN KEY ("internalOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ExportInstitutionEvidence" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceTitle" TEXT NOT NULL,
  "evidenceClass" "ExportInstitutionEvidenceClass" NOT NULL,
  "supportedClaim" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "reviewerUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportInstitutionEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExportInstitutionEvidence_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "ExportInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExportInstitutionEvidence_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ExportInstitution_countryCode_category_idx" ON "ExportInstitution"("countryCode", "category");
CREATE INDEX "ExportInstitution_relationshipStatus_updatedAt_idx" ON "ExportInstitution"("relationshipStatus", "updatedAt");
CREATE INDEX "ExportInstitution_verificationStatus_nextReviewAt_idx" ON "ExportInstitution"("verificationStatus", "nextReviewAt");
CREATE INDEX "ExportInstitution_createdAt_idx" ON "ExportInstitution"("createdAt");
CREATE INDEX "ExportInstitutionEvidence_institutionId_observedAt_idx" ON "ExportInstitutionEvidence"("institutionId", "observedAt");
CREATE INDEX "ExportInstitutionEvidence_evidenceClass_verifiedAt_idx" ON "ExportInstitutionEvidence"("evidenceClass", "verifiedAt");
