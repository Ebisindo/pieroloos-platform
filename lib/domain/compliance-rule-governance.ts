import { complianceRuleVersionSchema, type ComplianceRuleVersionInput } from "@/lib/validation/compliance-rule-version";

export type ComplianceRuleAssessmentState = "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
export type ComplianceRuleAssessmentReason =
  | "INVALID_RULE_RECORD"
  | "RULE_NOT_REVIEWED"
  | "RULE_REJECTED"
  | "RULE_SUPERSEDED"
  | "SOURCE_NOT_RETRIEVED"
  | "SOURCE_NOT_YET_EFFECTIVE"
  | "SOURCE_EXPIRED"
  | "JURISDICTION_MISMATCH"
  | "MISSING_BUSINESS_TYPE"
  | "BUSINESS_TYPE_MISMATCH"
  | "MISSING_FORMATION_STATE"
  | "FORMATION_STATE_MISMATCH";

export type ComplianceRuleAssessment = {
  state: ComplianceRuleAssessmentState;
  ruleId: string | null;
  ruleVersion: number | null;
  reasons: ComplianceRuleAssessmentReason[];
  mayGenerateObligation: boolean;
};

/**
 * Conservative assessment gate. It deliberately does not calculate legal applicability:
 * the registry must first hold a valid, reviewed, source-backed rule and sufficient facts.
 * "Not applicable" is returned only when a reviewed rule contains enough facts to prove a mismatch.
 */
export function assessComplianceRuleReadiness(
  rawRule: unknown,
  context: {
    jurisdictionId: string;
    businessType?: string | null;
    formationCompleted?: boolean | null;
    evaluatedAt?: Date;
  },
): ComplianceRuleAssessment {
  const parsed = complianceRuleVersionSchema.safeParse(rawRule);
  if (!parsed.success) {
    return { state: "UNKNOWN", ruleId: null, ruleVersion: null, reasons: ["INVALID_RULE_RECORD"], mayGenerateObligation: false };
  }

  const rule: ComplianceRuleVersionInput = parsed.data;
  const evaluatedAt = context.evaluatedAt ?? new Date();
  const reasons: ComplianceRuleAssessmentReason[] = [];

  if (rule.reviewState === "REJECTED") reasons.push("RULE_REJECTED");
  if (rule.reviewState === "SUPERSEDED") reasons.push("RULE_SUPERSEDED");
  if (rule.reviewState !== "VERIFIED") reasons.push("RULE_NOT_REVIEWED");
  if (!rule.sourceRetrievedAt) reasons.push("SOURCE_NOT_RETRIEVED");
  if (rule.effectiveFrom > evaluatedAt) reasons.push("SOURCE_NOT_YET_EFFECTIVE");
  if (rule.effectiveThrough && rule.effectiveThrough < evaluatedAt) reasons.push("SOURCE_EXPIRED");

  if (reasons.length) {
    return { state: "UNKNOWN", ruleId: rule.ruleId, ruleVersion: rule.version, reasons, mayGenerateObligation: false };
  }

  if (rule.jurisdictionId !== context.jurisdictionId) {
    return { state: "NOT_APPLICABLE", ruleId: rule.ruleId, ruleVersion: rule.version, reasons: ["JURISDICTION_MISMATCH"], mayGenerateObligation: false };
  }

  if (rule.applicability.businessTypes?.length) {
    if (!context.businessType) {
      return { state: "UNKNOWN", ruleId: rule.ruleId, ruleVersion: rule.version, reasons: ["MISSING_BUSINESS_TYPE"], mayGenerateObligation: false };
    }
    if (!rule.applicability.businessTypes.includes(context.businessType)) {
      return { state: "NOT_APPLICABLE", ruleId: rule.ruleId, ruleVersion: rule.version, reasons: ["BUSINESS_TYPE_MISMATCH"], mayGenerateObligation: false };
    }
  }

  if (rule.applicability.formationCompleted !== undefined) {
    if (context.formationCompleted === null || context.formationCompleted === undefined) {
      return { state: "UNKNOWN", ruleId: rule.ruleId, ruleVersion: rule.version, reasons: ["MISSING_FORMATION_STATE"], mayGenerateObligation: false };
    }
    if (rule.applicability.formationCompleted !== context.formationCompleted) {
      return { state: "NOT_APPLICABLE", ruleId: rule.ruleId, ruleVersion: rule.version, reasons: ["FORMATION_STATE_MISMATCH"], mayGenerateObligation: false };
    }
  }

  // Applicability has enough facts to pass the gate, but this helper alone never generates
  // obligations; a persistent registry, idempotency key and audited generation transaction are required.
  return { state: "APPLICABLE", ruleId: rule.ruleId, ruleVersion: rule.version, reasons: [], mayGenerateObligation: false };
}
