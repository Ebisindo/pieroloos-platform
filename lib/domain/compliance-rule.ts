import type { EvidenceClass } from "./evidence";
import type { ObligationType } from "./compliance";
import type { JurisdictionSupersessionState } from "./jurisdiction";

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
  sourceId?: string | null;
  sourceAuthority?: string | null;
  publicationDate?: Date | null;
  effectiveDate?: Date | null;
  retrievalDate?: Date | null;
  confidence?: number | null;
  evidenceClass?: EvidenceClass | null;
  reviewerUserId?: string | null;
  supersessionState?: JurisdictionSupersessionState | null;
  supersededByRuleId?: string | null;
};

export function calculateDueAt(baseDate: Date, relativeDueDays?: number | null) {
  if (relativeDueDays == null) return null;
  const due = new Date(baseDate);
  due.setUTCDate(due.getUTCDate() + relativeDueDays);
  return due;
}
