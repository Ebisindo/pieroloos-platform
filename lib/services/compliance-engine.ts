import { calculateDueAt } from "../domain/compliance-rule";
import type { ComplianceRule, ComplianceRuleContext } from "../domain/compliance-rule";

export function generateObligationsFromRules(
  rules: ComplianceRule[],
  context: ComplianceRuleContext,
  baseDate = context.formationCompletedAt ?? new Date(),
) {
  return rules
    .filter(r => r.active && r.jurisdictionId === context.jurisdictionId)
    .map(r => ({
      ruleId: r.id, title: r.title, description: r.description, type: r.type,
      dueAt: calculateDueAt(baseDate, r.relativeDueDays),
      professionalReviewRequired: r.professionalReviewRequired,
      evidenceRequired: r.requiredEvidence,
    }));
}
