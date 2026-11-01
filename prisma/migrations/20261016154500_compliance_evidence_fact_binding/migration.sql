-- Structured fact assertion tied to a compliance evidence record.
-- Assertions are not trusted as verified until the existing independent review lifecycle marks the evidence VERIFIED.
ALTER TABLE "ComplianceEvidence"
  ADD COLUMN "factKey" TEXT,
  ADD COLUMN "factValue" TEXT;

ALTER TABLE "ComplianceEvidence"
  ADD CONSTRAINT "ComplianceEvidence_fact_assertion_pair_check"
  CHECK (("factKey" IS NULL AND "factValue" IS NULL) OR
         ("factKey" IS NOT NULL AND "factValue" IS NOT NULL));
