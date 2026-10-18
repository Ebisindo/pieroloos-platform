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


-- Enforce that the referenced document is the source document for this evidence,
-- and that the client/workspace scope on the binding exactly matches the document.
-- Composite FKs above protect workspace/client existence; this trigger protects
-- the cross-column relationship which ordinary FKs cannot express independently.
CREATE OR REPLACE FUNCTION enforce_business_intent_evidence_reference_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  proposal_client_id TEXT;
  document_client_id TEXT;
  document_evidence_id TEXT;
  document_status TEXT;
  document_scan_status TEXT;
  document_review_status TEXT;
  document_deleted_at TIMESTAMP(3);
  evidence_review_status TEXT;
  evidence_class TEXT;
  evidence_source TEXT;
  evidence_retrieved_at TIMESTAMP(3);
BEGIN
  -- Serialize the bind against changes to the proposal's client scope.
  SELECT "clientId"
    INTO proposal_client_id
    FROM "BusinessIntentProposal"
   WHERE "id" = NEW."proposalId"
     AND "workspaceId" = NEW."workspaceId"
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business-intent evidence proposal must exist in the same workspace'
      USING ERRCODE = '23503';
  END IF;

  IF proposal_client_id IS DISTINCT FROM NEW."clientId" THEN
    RAISE EXCEPTION 'Business-intent evidence client must match the proposal client'
      USING ERRCODE = '23514';
  END IF;

  -- Lock the document row and ensure both tenant and source identity match the link.
  SELECT "clientId", "evidenceId", "status"::text, "scanStatus"::text,
         "reviewStatus"::text, "deletedAt"
    INTO document_client_id, document_evidence_id, document_status,
         document_scan_status, document_review_status, document_deleted_at
    FROM "Document"
   WHERE "id" = NEW."documentId"
     AND "workspaceId" = NEW."workspaceId"
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business-intent evidence document must exist in the same workspace'
      USING ERRCODE = '23503';
  END IF;

  IF document_client_id IS DISTINCT FROM NEW."clientId" THEN
    RAISE EXCEPTION 'Business-intent evidence client must match the source document client'
      USING ERRCODE = '23514';
  END IF;

  IF document_evidence_id IS DISTINCT FROM NEW."evidenceId" THEN
    RAISE EXCEPTION 'Business-intent evidence ID must match the source document evidence ID'
      USING ERRCODE = '23514';
  END IF;

  IF document_status IS DISTINCT FROM 'AVAILABLE'
    OR document_scan_status IS DISTINCT FROM 'CLEAN'
    OR document_review_status IS DISTINCT FROM 'VERIFIED'
    OR document_deleted_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'Business-intent evidence document must be available, clean, verified, and not deleted'
      USING ERRCODE = '23514';
  END IF;

  -- Lock the authoritative source so a concurrent revoke/update cannot slip between
  -- the eligibility check and binding. Revocation after binding remains auditable history.
  SELECT "reviewStatus", "evidenceClass"::text, "source", "retrievedAt"
    INTO evidence_review_status, evidence_class, evidence_source, evidence_retrieved_at
    FROM "Evidence"
   WHERE "id" = NEW."evidenceId"
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business-intent evidence source does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF evidence_review_status IS DISTINCT FROM 'VERIFIED'
    OR evidence_class NOT IN ('E3', 'E4', 'E3_PRIMARY', 'E4_CROSS_VERIFIED')
    OR evidence_source IS NULL
    OR btrim(evidence_source) NOT LIKE 'https://%'
    OR evidence_retrieved_at IS NULL
  THEN
    RAISE EXCEPTION 'Business-intent evidence source is not eligible for verified binding'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."verificationState" IS DISTINCT FROM 'SOURCE_VERIFIED_RECORD'
    OR btrim(NEW."claimStatement") = ''
  THEN
    RAISE EXCEPTION 'Business-intent evidence binding must preserve a verified source record and non-empty claim'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER "BusinessIntentEvidenceReference_scope_guard"
BEFORE INSERT OR UPDATE OF "documentId", "workspaceId", "clientId", "evidenceId"
ON "BusinessIntentEvidenceReference"
FOR EACH ROW EXECUTE FUNCTION enforce_business_intent_evidence_reference_scope();

-- Preserve the identity binding once used by a saved proposal. Lifecycle/status
-- changes to a document remain possible, but changing its tenant/client/evidence
-- identity cannot silently rewrite the meaning of an existing proposal reference.
CREATE OR REPLACE FUNCTION prevent_rebinding_referenced_business_intent_document()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId"
    OR OLD."clientId" IS DISTINCT FROM NEW."clientId"
    OR OLD."evidenceId" IS DISTINCT FROM NEW."evidenceId"
  THEN
    IF EXISTS (
      SELECT 1
        FROM "BusinessIntentEvidenceReference" binding
       WHERE binding."documentId" = OLD."id"
         AND binding."workspaceId" = OLD."workspaceId"
    ) THEN
      RAISE EXCEPTION 'Document identity is bound to a business-intent evidence reference; create a replacement document'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Document_business_intent_evidence_identity_guard"
BEFORE UPDATE OF "workspaceId", "clientId", "evidenceId" ON "Document"
FOR EACH ROW EXECUTE FUNCTION prevent_rebinding_referenced_business_intent_document();
