CREATE TYPE "PartnershipInquiryType" AS ENUM (
  'PROFESSIONAL_SERVICES',
  'TECHNOLOGY_PROVIDER',
  'FINANCIAL_INSTITUTION',
  'INSTITUTIONAL_PARTNER',
  'STRATEGIC_SPONSOR_INVESTOR',
  'DISTRIBUTION_ECOSYSTEM'
);

CREATE TYPE "PartnershipInquiryStatus" AS ENUM ('NEW', 'IN_REVIEW', 'CLOSED');

CREATE TABLE "PartnershipInquiry" (
  "id" TEXT NOT NULL,
  "partnerType" "PartnershipInquiryType" NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "organisationName" TEXT NOT NULL,
  "websiteUrl" TEXT,
  "country" TEXT,
  "message" TEXT NOT NULL,
  "consentAcceptedAt" TIMESTAMP(3) NOT NULL,
  "status" "PartnershipInquiryStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnershipInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnershipInquiry_status_createdAt_idx" ON "PartnershipInquiry"("status", "createdAt");
CREATE INDEX "PartnershipInquiry_createdAt_idx" ON "PartnershipInquiry"("createdAt");
