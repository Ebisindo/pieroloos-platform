import type { ObligationType } from "./compliance";

export type ComplianceRuleContext = {
  jurisdictionId: string;
  businessType?: string | null;
  formationPlanId?: string | null;
  formationCompletedAt?: Date | null;
};

export type ComplianceRule = {
  id: string; version: string; jurisdictionId: string; title: string;
  description?: string; type: ObligationType; relativeDueDays?: number | null;
  professionalReviewRequired: boolean; requiredEvidence: boolean; active: boolean;
};

export function calculateDueAt(baseDate: Date, relativeDueDays?: number | null) {
  if (relativeDueDays == null) return null;
  const due = new Date(baseDate);
  due.setUTCDate(due.getUTCDate() + relativeDueDays);
  return due;
}
