-- Immutable rule content: material changes require a new version. Only the review and supersession
-- lifecycle fields may transition, and verification must remain an independent sourced decision.
CREATE OR REPLACE FUNCTION guard_compliance_rule_version_content()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."ruleId" IS DISTINCT FROM NEW."ruleId"
    OR OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId"
    OR OLD."version" IS DISTINCT FROM NEW."version"
    OR OLD."jurisdictionId" IS DISTINCT FROM NEW."jurisdictionId"
    OR OLD."title" IS DISTINCT FROM NEW."title"
    OR OLD."description" IS DISTINCT FROM NEW."description"
    OR OLD."obligationType" IS DISTINCT FROM NEW."obligationType"
    OR OLD."sourceAuthority" IS DISTINCT FROM NEW."sourceAuthority"
    OR OLD."sourceUrl" IS DISTINCT FROM NEW."sourceUrl"
    OR OLD."publicationDate" IS DISTINCT FROM NEW."publicationDate"
    OR OLD."effectiveFrom" IS DISTINCT FROM NEW."effectiveFrom"
    OR OLD."effectiveThrough" IS DISTINCT FROM NEW."effectiveThrough"
    OR OLD."applicability" IS DISTINCT FROM NEW."applicability"
    OR OLD."relativeDueDays" IS DISTINCT FROM NEW."relativeDueDays"
    OR OLD."requiresEvidence" IS DISTINCT FROM NEW."requiresEvidence"
    OR OLD."professionalReviewRequired" IS DISTINCT FROM NEW."professionalReviewRequired"
    OR OLD."createdByUserId" IS DISTINCT FROM NEW."createdByUserId"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'Compliance rule version content is immutable; create a new version';
  END IF;

  IF OLD."reviewState" = 'UNREVIEWED'
    AND NEW."reviewState" IN ('VERIFIED', 'REJECTED')
  THEN
    IF NEW."reviewedByUserId" IS NULL
      OR NEW."reviewedAt" IS NULL
      OR NEW."reviewNote" IS NULL
      OR length(btrim(NEW."reviewNote")) < 8
      OR NEW."reviewedByUserId" = NEW."createdByUserId"
    THEN
      RAISE EXCEPTION 'Rule review must have an independent reviewer, timestamp, and note';
    END IF;

    IF NEW."reviewState" = 'VERIFIED'
      AND (NEW."sourceRetrievedAt" IS NULL OR NEW."evidenceClass" NOT IN ('E3', 'E4'))
    THEN
      RAISE EXCEPTION 'Rule verification requires a retrieved source and E3/E4 evidence';
    END IF;

    IF NEW."reviewState" = 'REJECTED'
      AND (NEW."evidenceClass" IS DISTINCT FROM OLD."evidenceClass"
        OR NEW."sourceRetrievedAt" IS DISTINCT FROM OLD."sourceRetrievedAt")
    THEN
      RAISE EXCEPTION 'Rejected rule versions cannot acquire verification evidence';
    END IF;

    IF NEW."supersededByVersion" IS DISTINCT FROM OLD."supersededByVersion" THEN
      RAISE EXCEPTION 'Reviewing a rule version cannot supersede it in the same transition';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."reviewState" = 'SUPERSEDED'
    AND OLD."reviewState" <> 'SUPERSEDED'
    AND OLD."supersededByVersion" IS NULL
    AND NEW."supersededByVersion" IS NOT NULL
    AND NEW."supersededByVersion" > OLD."version"
    AND NEW."evidenceClass" IS NOT DISTINCT FROM OLD."evidenceClass"
    AND NEW."sourceRetrievedAt" IS NOT DISTINCT FROM OLD."sourceRetrievedAt"
    AND NEW."reviewedByUserId" IS NOT DISTINCT FROM OLD."reviewedByUserId"
    AND NEW."reviewedAt" IS NOT DISTINCT FROM OLD."reviewedAt"
    AND NEW."reviewNote" IS NOT DISTINCT FROM OLD."reviewNote"
  THEN
    RETURN NEW;
  END IF;

  IF NEW."reviewState" IS DISTINCT FROM OLD."reviewState"
    OR NEW."evidenceClass" IS DISTINCT FROM OLD."evidenceClass"
    OR NEW."sourceRetrievedAt" IS DISTINCT FROM OLD."sourceRetrievedAt"
    OR NEW."reviewedByUserId" IS DISTINCT FROM OLD."reviewedByUserId"
    OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt"
    OR NEW."reviewNote" IS DISTINCT FROM OLD."reviewNote"
    OR NEW."supersededByVersion" IS DISTINCT FROM OLD."supersededByVersion"
  THEN
    RAISE EXCEPTION 'Compliance rule review and supersession state cannot be rewritten';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ComplianceRuleVersion_content_immutable"
BEFORE UPDATE ON "ComplianceRuleVersion"
FOR EACH ROW EXECUTE FUNCTION guard_compliance_rule_version_content();
