-- Evidence claims are append-only. Review state, reviewer, and review notes may change;
-- corrections to source facts, document references, or validity must create a replacement record.
CREATE OR REPLACE FUNCTION prevent_compliance_evidence_claim_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId"
    OR OLD."obligationId" IS DISTINCT FROM NEW."obligationId"
    OR OLD."documentId" IS DISTINCT FROM NEW."documentId"
    OR OLD."evidenceClass" IS DISTINCT FROM NEW."evidenceClass"
    OR OLD."factKey" IS DISTINCT FROM NEW."factKey"
    OR OLD."factValue" IS DISTINCT FROM NEW."factValue"
    OR OLD."note" IS DISTINCT FROM NEW."note"
    OR OLD."sourceReference" IS DISTINCT FROM NEW."sourceReference"
    OR OLD."validThrough" IS DISTINCT FROM NEW."validThrough"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'Compliance evidence claims are immutable; attach a replacement evidence record';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ComplianceEvidence_claims_immutable"
BEFORE UPDATE ON "ComplianceEvidence"
FOR EACH ROW EXECUTE FUNCTION prevent_compliance_evidence_claim_mutation();
