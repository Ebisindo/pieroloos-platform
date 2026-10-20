CREATE TYPE "BillingPlanTier" AS ENUM ('FREE', 'FOUNDER', 'PROFESSIONAL', 'FIRM', 'ENTERPRISE');
CREATE TYPE "BillingEntitlementKind" AS ENUM ('ACCESS', 'LIMIT', 'METERED', 'CREDIT');
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'ENDED');
CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR', 'CUSTOM');
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');
CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "BillingCreditEntryType" AS ENUM ('GRANT', 'PURCHASE', 'USAGE', 'EXPIRY', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "BillingCreditDirection" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "BillingInvoiceLineType" AS ENUM ('SUBSCRIPTION', 'USAGE', 'CREDITS', 'PROFESSIONAL_REVIEW', 'OTHER');
CREATE TYPE "BillingWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "BillingPlanTier" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingPlanEntitlement" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "BillingEntitlementKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER,
    "unit" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPlanEntitlement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingPlanEntitlement_limit_check" CHECK ("limit" IS NULL OR "limit" >= 0)
);

CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "provider" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingSubscription_period_check" CHECK ("currentPeriodEnd" > "currentPeriodStart")
);

CREATE TABLE "BillingUsageEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "entitlementKey" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingUsageEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingUsageEvent_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "BillingCreditEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "entryType" "BillingCreditEntryType" NOT NULL,
    "direction" "BillingCreditDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "creditType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingCreditEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingCreditEntry_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "provider" TEXT,
    "providerInvoiceId" TEXT,
    "invoiceNumber" TEXT,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL,
    "amountDueMinor" BIGINT NOT NULL DEFAULT 0,
    "amountPaidMinor" BIGINT NOT NULL DEFAULT 0,
    "amountRemainingMinor" BIGINT NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingInvoice_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "BillingInvoice_amounts_check" CHECK ("amountDueMinor" >= 0 AND "amountPaidMinor" >= 0 AND "amountRemainingMinor" >= 0),
    CONSTRAINT "BillingInvoice_period_check" CHECK ("periodEnd" IS NULL OR "periodStart" IS NULL OR "periodEnd" > "periodStart")
);

CREATE TABLE "BillingInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineType" "BillingInvoiceLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitAmountMinor" BIGINT NOT NULL,
    "totalAmountMinor" BIGINT NOT NULL,
    "entitlementKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingInvoiceLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingInvoiceLine_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "BillingPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "provider" TEXT,
    "providerPaymentId" TEXT,
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "refundedAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BillingPayment_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "BillingPayment_amount_check" CHECK ("amountMinor" > 0 AND "refundedAmountMinor" >= 0 AND "refundedAmountMinor" <= "amountMinor")
);

CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "BillingWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPlan_key_key" ON "BillingPlan"("key");
CREATE INDEX "BillingPlan_tier_active_idx" ON "BillingPlan"("tier", "active");
CREATE UNIQUE INDEX "BillingPlanEntitlement_planId_key_key" ON "BillingPlanEntitlement"("planId", "key");
CREATE INDEX "BillingPlanEntitlement_key_enabled_idx" ON "BillingPlanEntitlement"("key", "enabled");
CREATE UNIQUE INDEX "BillingSubscription_provider_providerSubscriptionId_key" ON "BillingSubscription"("provider", "providerSubscriptionId");
CREATE INDEX "BillingSubscription_organizationId_status_currentPeriodEnd_idx" ON "BillingSubscription"("organizationId", "status", "currentPeriodEnd");
CREATE INDEX "BillingSubscription_planId_idx" ON "BillingSubscription"("planId");
CREATE UNIQUE INDEX "BillingUsageEvent_organizationId_idempotencyKey_key" ON "BillingUsageEvent"("organizationId", "idempotencyKey");
CREATE INDEX "BillingUsageEvent_organizationId_entitlementKey_occurredAt_idx" ON "BillingUsageEvent"("organizationId", "entitlementKey", "occurredAt");
CREATE INDEX "BillingUsageEvent_workspaceId_entitlementKey_occurredAt_idx" ON "BillingUsageEvent"("workspaceId", "entitlementKey", "occurredAt");
CREATE UNIQUE INDEX "BillingCreditEntry_organizationId_idempotencyKey_key" ON "BillingCreditEntry"("organizationId", "idempotencyKey");
CREATE INDEX "BillingCreditEntry_organizationId_creditType_occurredAt_idx" ON "BillingCreditEntry"("organizationId", "creditType", "occurredAt");
CREATE INDEX "BillingCreditEntry_workspaceId_creditType_occurredAt_idx" ON "BillingCreditEntry"("workspaceId", "creditType", "occurredAt");
CREATE UNIQUE INDEX "BillingInvoice_provider_providerInvoiceId_key" ON "BillingInvoice"("provider", "providerInvoiceId");
CREATE UNIQUE INDEX "BillingInvoice_organizationId_invoiceNumber_key" ON "BillingInvoice"("organizationId", "invoiceNumber");
CREATE INDEX "BillingInvoice_organizationId_status_createdAt_idx" ON "BillingInvoice"("organizationId", "status", "createdAt");
CREATE INDEX "BillingInvoice_subscriptionId_idx" ON "BillingInvoice"("subscriptionId");
CREATE INDEX "BillingInvoiceLine_invoiceId_lineType_idx" ON "BillingInvoiceLine"("invoiceId", "lineType");
CREATE UNIQUE INDEX "BillingPayment_provider_providerPaymentId_key" ON "BillingPayment"("provider", "providerPaymentId");
CREATE INDEX "BillingPayment_organizationId_status_createdAt_idx" ON "BillingPayment"("organizationId", "status", "createdAt");
CREATE INDEX "BillingPayment_invoiceId_idx" ON "BillingPayment"("invoiceId");
CREATE UNIQUE INDEX "BillingWebhookEvent_provider_providerEventId_key" ON "BillingWebhookEvent"("provider", "providerEventId");
CREATE INDEX "BillingWebhookEvent_status_receivedAt_idx" ON "BillingWebhookEvent"("status", "receivedAt");
CREATE INDEX "BillingWebhookEvent_organizationId_receivedAt_idx" ON "BillingWebhookEvent"("organizationId", "receivedAt");

ALTER TABLE "BillingPlanEntitlement"
  ADD CONSTRAINT "BillingPlanEntitlement_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingSubscription"
  ADD CONSTRAINT "BillingSubscription_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingSubscription"
  ADD CONSTRAINT "BillingSubscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingUsageEvent"
  ADD CONSTRAINT "BillingUsageEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingUsageEvent"
  ADD CONSTRAINT "BillingUsageEvent_organizationId_workspaceId_fkey"
  FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingCreditEntry"
  ADD CONSTRAINT "BillingCreditEntry_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingCreditEntry"
  ADD CONSTRAINT "BillingCreditEntry_organizationId_workspaceId_fkey"
  FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingInvoice"
  ADD CONSTRAINT "BillingInvoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingInvoice"
  ADD CONSTRAINT "BillingInvoice_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "BillingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingInvoiceLine"
  ADD CONSTRAINT "BillingInvoiceLine_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingPayment"
  ADD CONSTRAINT "BillingPayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingWebhookEvent"
  ADD CONSTRAINT "BillingWebhookEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
