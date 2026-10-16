-- Additive, tenant-scoped professional-partner identity and grant lifecycle.
-- Public partnership inquiries are deliberately not upgraded into identities or grants.
CREATE TYPE "ProfessionalPartnerType" AS ENUM (
  'LEGAL_COUNSEL', 'ACCOUNTANT', 'TAX_ADVISOR', 'CORPORATE_SECRETARY', 'AUDITOR', 'CONSULTANT', 'OTHER'
);
CREATE TYPE "ProfessionalPartnerIdentityStatus" AS ENUM (
  'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUSPENDED'
);
CREATE TYPE "ProfessionalPartnerGrantPurpose" AS ENUM (
  'LEGAL_REVIEW', 'ACCOUNTING_REVIEW', 'TAX_REVIEW', 'COMPANY_SECRETARIAL', 'AUDIT', 'BUSINESS_ADVISORY', 'OTHER'
);
CREATE TYPE "ProfessionalPartnerCapability" AS ENUM (
  'CLIENT_PROFILE_READ', 'COMPLIANCE_READ', 'DOCUMENT_METADATA_READ', 'EVIDENCE_ATTACH', 'GRAPH_READ', 'REPORT_READ'
);
CREATE TYPE "ProfessionalPartnerGrantStatus" AS ENUM (
  'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'REVOKED'
);

CREATE TABLE "ProfessionalPartnerIdentity" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "organizationName" TEXT NOT NULL,
  "professionalType" "ProfessionalPartnerType" NOT NULL,
  "professionalRegistrationRef" TEXT,
  "status" "ProfessionalPartnerIdentityStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "createdByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "suspendedByUserId" TEXT,
  "suspendedAt" TIMESTAMP(3),
  "suspensionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalPartnerIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalPartnerIdentity_contact_name_check" CHECK (length(btrim("contactName")) BETWEEN 2 AND 160),
  CONSTRAINT "ProfessionalPartnerIdentity_organization_name_check" CHECK (length(btrim("organizationName")) BETWEEN 2 AND 200),
  CONSTRAINT "ProfessionalPartnerIdentity_registration_ref_check" CHECK ("professionalRegistrationRef" IS NULL OR length(btrim("professionalRegistrationRef")) BETWEEN 2 AND 120),
  CONSTRAINT "ProfessionalPartnerIdentity_review_check" CHECK (
    ("status" = 'PENDING_VERIFICATION' AND "reviewedByUserId" IS NULL AND "reviewedAt" IS NULL AND "reviewNote" IS NULL)
    OR
    ("status" IN ('VERIFIED', 'REJECTED', 'SUSPENDED')
      AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL
      AND "reviewNote" IS NOT NULL AND length(btrim("reviewNote")) >= 8
      AND "reviewedByUserId" <> "createdByUserId"
      AND "reviewedByUserId" <> "userId")
  ),
  CONSTRAINT "ProfessionalPartnerIdentity_suspension_check" CHECK (
    ("status" = 'SUSPENDED' AND "suspendedByUserId" IS NOT NULL AND "suspendedAt" IS NOT NULL
      AND "suspensionReason" IS NOT NULL AND length(btrim("suspensionReason")) >= 8)
    OR
    ("status" <> 'SUSPENDED' AND "suspendedByUserId" IS NULL AND "suspendedAt" IS NULL AND "suspensionReason" IS NULL)
  )
);
CREATE UNIQUE INDEX "ProfessionalPartnerIdentity_organizationId_workspaceId_userId_key"
  ON "ProfessionalPartnerIdentity"("organizationId", "workspaceId", "userId");
CREATE UNIQUE INDEX "ProfessionalPartnerIdentity_id_organizationId_workspaceId_key"
  ON "ProfessionalPartnerIdentity"("id", "organizationId", "workspaceId");
CREATE INDEX "ProfessionalPartnerIdentity_organizationId_workspaceId_status_idx"
  ON "ProfessionalPartnerIdentity"("organizationId", "workspaceId", "status");
CREATE INDEX "ProfessionalPartnerIdentity_userId_status_idx"
  ON "ProfessionalPartnerIdentity"("userId", "status");

CREATE TABLE "ProfessionalPartnerGrant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "partnerIdentityId" TEXT NOT NULL,
  "grantKey" TEXT NOT NULL,
  "requestDigest" TEXT NOT NULL,
  "purpose" "ProfessionalPartnerGrantPurpose" NOT NULL,
  "purposeDetails" TEXT,
  "capabilities" "ProfessionalPartnerCapability"[] NOT NULL DEFAULT ARRAY[]::"ProfessionalPartnerCapability"[],
  "status" "ProfessionalPartnerGrantStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "grantedByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "changeRequestReason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "revocationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalPartnerGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalPartnerGrant_key_check" CHECK (length(btrim("grantKey")) BETWEEN 8 AND 128),
  CONSTRAINT "ProfessionalPartnerGrant_purpose_details_check" CHECK (
    ("purpose" = 'OTHER' AND "purposeDetails" IS NOT NULL AND length(btrim("purposeDetails")) >= 8)
    OR ("purpose" <> 'OTHER' AND ("purposeDetails" IS NULL OR length(btrim("purposeDetails")) <= 1000))
  ),
  CONSTRAINT "ProfessionalPartnerGrant_capabilities_check" CHECK (cardinality("capabilities") > 0),
  CONSTRAINT "ProfessionalPartnerGrant_review_check" CHECK (
    ("status" = 'PENDING_REVIEW' AND "reviewedByUserId" IS NULL AND "reviewedAt" IS NULL AND "reviewNote" IS NULL)
    OR
    ("status" IN ('ACTIVE', 'REJECTED') AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL
      AND "reviewNote" IS NOT NULL AND length(btrim("reviewNote")) >= 8
      AND "reviewedByUserId" <> "grantedByUserId")
  ),
  CONSTRAINT "ProfessionalPartnerGrant_revocation_check" CHECK (
    ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL AND "revokedByUserId" IS NOT NULL
      AND "revocationReason" IS NOT NULL AND length(btrim("revocationReason")) >= 8)
    OR
    ("status" <> 'REVOKED' AND "revokedAt" IS NULL AND "revokedByUserId" IS NULL AND "revocationReason" IS NULL)
  ),
  CONSTRAINT "ProfessionalPartnerGrant_expiry_check" CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt")
);
CREATE UNIQUE INDEX "ProfessionalPartnerGrant_organizationId_workspaceId_grantKey_key"
  ON "ProfessionalPartnerGrant"("organizationId", "workspaceId", "grantKey");
CREATE UNIQUE INDEX "ProfessionalPartnerGrant_id_organizationId_workspaceId_clientId_key"
  ON "ProfessionalPartnerGrant"("id", "organizationId", "workspaceId", "clientId");
CREATE INDEX "ProfessionalPartnerGrant_partnerIdentityId_status_expiresAt_revokedAt_idx"
  ON "ProfessionalPartnerGrant"("partnerIdentityId", "status", "expiresAt", "revokedAt");
CREATE INDEX "ProfessionalPartnerGrant_organizationId_workspaceId_clientId_status_idx"
  ON "ProfessionalPartnerGrant"("organizationId", "workspaceId", "clientId", "status");

CREATE TABLE "ProfessionalPartnerIdentityAuditEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalPartnerIdentityAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalPartnerIdentityAuditEvent_action_check" CHECK (length(btrim("action")) BETWEEN 2 AND 120)
);
CREATE INDEX "ProfessionalPartnerIdentityAuditEvent_organizationId_workspaceId_occurredAt_idx"
  ON "ProfessionalPartnerIdentityAuditEvent"("organizationId", "workspaceId", "occurredAt");
CREATE INDEX "ProfessionalPartnerIdentityAuditEvent_identityId_occurredAt_idx"
  ON "ProfessionalPartnerIdentityAuditEvent"("identityId", "occurredAt");
CREATE INDEX "ProfessionalPartnerIdentityAuditEvent_actorUserId_occurredAt_idx"
  ON "ProfessionalPartnerIdentityAuditEvent"("actorUserId", "occurredAt");

CREATE TABLE "ProfessionalPartnerGrantAuditEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "partnerIdentityId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfessionalPartnerGrantAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionalPartnerGrantAuditEvent_action_check" CHECK (length(btrim("action")) BETWEEN 2 AND 120)
);
CREATE INDEX "ProfessionalPartnerGrantAuditEvent_organizationId_workspaceId_occurredAt_idx"
  ON "ProfessionalPartnerGrantAuditEvent"("organizationId", "workspaceId", "occurredAt");
CREATE INDEX "ProfessionalPartnerGrantAuditEvent_clientId_occurredAt_idx"
  ON "ProfessionalPartnerGrantAuditEvent"("clientId", "occurredAt");
CREATE INDEX "ProfessionalPartnerGrantAuditEvent_grantId_occurredAt_idx"
  ON "ProfessionalPartnerGrantAuditEvent"("grantId", "occurredAt");
CREATE INDEX "ProfessionalPartnerGrantAuditEvent_actorUserId_occurredAt_idx"
  ON "ProfessionalPartnerGrantAuditEvent"("actorUserId", "occurredAt");

ALTER TABLE "ProfessionalPartnerIdentity"
  ADD CONSTRAINT "ProfessionalPartnerIdentity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerIdentity"
  ADD CONSTRAINT "ProfessionalPartnerIdentity_organizationId_workspaceId_fkey"
  FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerIdentity"
  ADD CONSTRAINT "ProfessionalPartnerIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerIdentity"
  ADD CONSTRAINT "ProfessionalPartnerIdentity_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerIdentity"
  ADD CONSTRAINT "ProfessionalPartnerIdentity_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerIdentity"
  ADD CONSTRAINT "ProfessionalPartnerIdentity_suspendedByUserId_fkey"
  FOREIGN KEY ("suspendedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfessionalPartnerGrant"
  ADD CONSTRAINT "ProfessionalPartnerGrant_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrant"
  ADD CONSTRAINT "ProfessionalPartnerGrant_organizationId_workspaceId_fkey"
  FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrant"
  ADD CONSTRAINT "ProfessionalPartnerGrant_clientId_workspaceId_fkey"
  FOREIGN KEY ("clientId", "workspaceId") REFERENCES "Client"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrant"
  ADD CONSTRAINT "ProfessionalPartnerGrant_partnerIdentityId_organizationId_workspaceId_fkey"
  FOREIGN KEY ("partnerIdentityId", "organizationId", "workspaceId")
  REFERENCES "ProfessionalPartnerIdentity"("id", "organizationId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrant"
  ADD CONSTRAINT "ProfessionalPartnerGrant_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrant"
  ADD CONSTRAINT "ProfessionalPartnerGrant_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrant"
  ADD CONSTRAINT "ProfessionalPartnerGrant_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfessionalPartnerIdentityAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerIdentityAuditEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerIdentityAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerIdentityAuditEvent_workspace_scope_fkey"
  FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerIdentityAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerIdentityAuditEvent_identityId_organizationId_workspaceId_fkey"
  FOREIGN KEY ("identityId", "organizationId", "workspaceId")
  REFERENCES "ProfessionalPartnerIdentity"("id", "organizationId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerIdentityAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerIdentityAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProfessionalPartnerGrantAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerGrantAuditEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrantAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerGrantAuditEvent_organizationId_workspaceId_fkey"
  FOREIGN KEY ("organizationId", "workspaceId") REFERENCES "Workspace"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrantAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerGrantAuditEvent_clientId_workspaceId_fkey"
  FOREIGN KEY ("clientId", "workspaceId") REFERENCES "Client"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrantAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerGrantAuditEvent_grantId_organizationId_workspaceId_clientId_fkey"
  FOREIGN KEY ("grantId", "organizationId", "workspaceId", "clientId")
  REFERENCES "ProfessionalPartnerGrant"("id", "organizationId", "workspaceId", "clientId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrantAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerGrantAuditEvent_partnerIdentityId_organizationId_workspaceId_fkey"
  FOREIGN KEY ("partnerIdentityId", "organizationId", "workspaceId")
  REFERENCES "ProfessionalPartnerIdentity"("id", "organizationId", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProfessionalPartnerGrantAuditEvent"
  ADD CONSTRAINT "ProfessionalPartnerGrantAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prevent privilege-bearing fields from being rewritten by a profile edit.
CREATE OR REPLACE FUNCTION guard_professional_partner_identity_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId"
    OR OLD."userId" IS DISTINCT FROM NEW."userId"
    OR OLD."contactName" IS DISTINCT FROM NEW."contactName"
    OR OLD."organizationName" IS DISTINCT FROM NEW."organizationName"
    OR OLD."professionalType" IS DISTINCT FROM NEW."professionalType"
    OR OLD."professionalRegistrationRef" IS DISTINCT FROM NEW."professionalRegistrationRef"
    OR OLD."createdByUserId" IS DISTINCT FROM NEW."createdByUserId"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'Professional partner identity details are immutable; create a reviewed replacement identity';
  END IF;

  IF OLD."status" = 'PENDING_VERIFICATION' AND NEW."status" IN ('VERIFIED', 'REJECTED') THEN
    IF NEW."reviewedByUserId" IS NULL OR NEW."reviewedAt" IS NULL
      OR NEW."reviewNote" IS NULL OR length(btrim(NEW."reviewNote")) < 8
      OR NEW."reviewedByUserId" = OLD."createdByUserId"
      OR NEW."reviewedByUserId" = OLD."userId"
      OR NEW."suspendedByUserId" IS NOT NULL OR NEW."suspendedAt" IS NOT NULL OR NEW."suspensionReason" IS NOT NULL
    THEN
      RAISE EXCEPTION 'Partner identity verification/rejection requires an independent reviewer and a note';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'VERIFIED' AND NEW."status" = 'SUSPENDED' THEN
    IF NEW."suspendedByUserId" IS NULL OR NEW."suspendedAt" IS NULL
      OR NEW."suspensionReason" IS NULL OR length(btrim(NEW."suspensionReason")) < 8
      OR NEW."suspendedByUserId" = OLD."userId"
    THEN
      RAISE EXCEPTION 'Partner identity suspension requires an authorized non-subject actor and a reason';
    END IF;
    IF NEW."reviewedByUserId" IS DISTINCT FROM OLD."reviewedByUserId"
      OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt"
      OR NEW."reviewNote" IS DISTINCT FROM OLD."reviewNote"
    THEN
      RAISE EXCEPTION 'Suspending a partner identity cannot rewrite its review history';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."status" IS DISTINCT FROM OLD."status"
    OR NEW."reviewedByUserId" IS DISTINCT FROM OLD."reviewedByUserId"
    OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt"
    OR NEW."reviewNote" IS DISTINCT FROM OLD."reviewNote"
    OR NEW."suspendedByUserId" IS DISTINCT FROM OLD."suspendedByUserId"
    OR NEW."suspendedAt" IS DISTINCT FROM OLD."suspendedAt"
    OR NEW."suspensionReason" IS DISTINCT FROM OLD."suspensionReason"
  THEN
    RAISE EXCEPTION 'Professional partner identity lifecycle transition is invalid';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ProfessionalPartnerIdentity_lifecycle_guard"
BEFORE UPDATE ON "ProfessionalPartnerIdentity"
FOR EACH ROW EXECUTE FUNCTION guard_professional_partner_identity_lifecycle();

-- A grant starts pending. Approval/rejection requires a different reviewer; amendments first
-- remove access by resetting the grant to PENDING_REVIEW; revoked/rejected grants are terminal.
CREATE OR REPLACE FUNCTION guard_professional_partner_grant_lifecycle()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE partner_user_id TEXT;
BEGIN
  IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
    OR OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId"
    OR OLD."clientId" IS DISTINCT FROM NEW."clientId"
    OR OLD."partnerIdentityId" IS DISTINCT FROM NEW."partnerIdentityId"
    OR OLD."grantKey" IS DISTINCT FROM NEW."grantKey"
    OR OLD."requestDigest" IS DISTINCT FROM NEW."requestDigest"
    OR OLD."grantedByUserId" IS DISTINCT FROM NEW."grantedByUserId"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'Professional partner grant scope and creator are immutable';
  END IF;

  SELECT "userId" INTO partner_user_id FROM "ProfessionalPartnerIdentity"
  WHERE "id" = OLD."partnerIdentityId" AND "organizationId" = OLD."organizationId"
    AND "workspaceId" = OLD."workspaceId";
  IF partner_user_id IS NULL THEN
    RAISE EXCEPTION 'Professional partner identity is missing from grant scope';
  END IF;

  IF OLD."status" = 'PENDING_REVIEW' AND NEW."status" IN ('ACTIVE', 'REJECTED') THEN
    IF OLD."purpose" IS DISTINCT FROM NEW."purpose"
      OR OLD."purposeDetails" IS DISTINCT FROM NEW."purposeDetails"
      OR OLD."capabilities" IS DISTINCT FROM NEW."capabilities"
      OR OLD."expiresAt" IS DISTINCT FROM NEW."expiresAt"
      OR OLD."changeRequestReason" IS DISTINCT FROM NEW."changeRequestReason"
      OR NEW."reviewedByUserId" IS NULL OR NEW."reviewedAt" IS NULL
      OR NEW."reviewNote" IS NULL OR length(btrim(NEW."reviewNote")) < 8
      OR NEW."reviewedByUserId" = OLD."grantedByUserId"
      OR NEW."reviewedByUserId" = partner_user_id
    THEN
      RAISE EXCEPTION 'Grant decision requires an independent reviewer and immutable pending terms';
    END IF;
    IF NEW."status" = 'ACTIVE' THEN
      IF NOT EXISTS (
        SELECT 1 FROM "ProfessionalPartnerIdentity" i
        WHERE i."id" = NEW."partnerIdentityId"
          AND i."organizationId" = NEW."organizationId"
          AND i."workspaceId" = NEW."workspaceId"
          AND i."status" = 'VERIFIED'
      ) THEN
        RAISE EXCEPTION 'Only verified partner identities can receive active grants';
      END IF;
      IF NEW."expiresAt" IS NOT NULL AND NEW."expiresAt" <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'Expired grants cannot be activated';
      END IF;
    END IF;
    IF NEW."revokedAt" IS NOT NULL OR NEW."revokedByUserId" IS NOT NULL OR NEW."revocationReason" IS NOT NULL THEN
      RAISE EXCEPTION 'Grant approval/rejection cannot set revocation metadata';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'ACTIVE' AND NEW."status" = 'PENDING_REVIEW' THEN
    IF NEW."purpose" IS NOT DISTINCT FROM OLD."purpose"
      AND NEW."purposeDetails" IS NOT DISTINCT FROM OLD."purposeDetails"
      AND NEW."capabilities" IS NOT DISTINCT FROM OLD."capabilities"
      AND NEW."expiresAt" IS NOT DISTINCT FROM OLD."expiresAt"
    THEN
      RAISE EXCEPTION 'A grant amendment must change the terms';
    END IF;
    IF NEW."changeRequestReason" IS NULL OR length(btrim(NEW."changeRequestReason")) < 8
      OR NEW."reviewedByUserId" IS NOT NULL OR NEW."reviewedAt" IS NOT NULL OR NEW."reviewNote" IS NOT NULL
      OR NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt"
      OR NEW."revokedByUserId" IS DISTINCT FROM OLD."revokedByUserId"
      OR NEW."revocationReason" IS DISTINCT FROM OLD."revocationReason"
    THEN
      RAISE EXCEPTION 'Grant amendments must become inactive and return for independent review';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" IN ('ACTIVE', 'PENDING_REVIEW') AND NEW."status" = 'REVOKED' THEN
    IF NEW."revokedAt" IS NULL OR NEW."revokedByUserId" IS NULL
      OR NEW."revocationReason" IS NULL OR length(btrim(NEW."revocationReason")) < 8
      OR NEW."revokedByUserId" = partner_user_id
    THEN
      RAISE EXCEPTION 'Grant revocation requires an authorized non-subject actor and a reason';
    END IF;
    IF NEW."purpose" IS DISTINCT FROM OLD."purpose"
      OR NEW."purposeDetails" IS DISTINCT FROM OLD."purposeDetails"
      OR NEW."capabilities" IS DISTINCT FROM OLD."capabilities"
      OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
      OR NEW."reviewedByUserId" IS DISTINCT FROM OLD."reviewedByUserId"
      OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt"
      OR NEW."reviewNote" IS DISTINCT FROM OLD."reviewNote"
    THEN
      RAISE EXCEPTION 'Revocation cannot rewrite a grant or its review history';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Professional partner grant lifecycle transition is invalid';
END;
$$;
CREATE TRIGGER "ProfessionalPartnerGrant_lifecycle_guard"
BEFORE UPDATE ON "ProfessionalPartnerGrant"
FOR EACH ROW EXECUTE FUNCTION guard_professional_partner_grant_lifecycle();

-- Audit history is tamper-evident at the database boundary: events cannot be updated or deleted.
CREATE OR REPLACE FUNCTION prevent_professional_partner_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Professional partner access audit history is append-only';
END;
$$;
CREATE TRIGGER "ProfessionalPartnerIdentityAuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "ProfessionalPartnerIdentityAuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_professional_partner_audit_mutation();
CREATE TRIGGER "ProfessionalPartnerGrantAuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "ProfessionalPartnerGrantAuditEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_professional_partner_audit_mutation();
