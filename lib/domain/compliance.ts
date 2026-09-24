export const COMPLIANCE_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETE",
  "BLOCKED",
] as const;

export type ComplianceStatus = typeof COMPLIANCE_STATUSES[number];

export const OBLIGATION_TYPES = [
  "FORMATION",
  "GOVERNANCE",
  "TAX",
  "IDENTIFICATION",
  "BANKING",
  "PAYMENT_INFRASTRUCTURE",
  "ANNUAL_FILING",
  "LICENSE",
  "REPORTING",
  "RENEWAL",
  "RECORDKEEPING",
  "OTHER",
] as const;

export type ObligationType = typeof OBLIGATION_TYPES[number];
export type EvidenceClass = "E0" | "E1" | "E2" | "E3" | "E4";

export type ComplianceObligation = {
  id: string;
  organizationId: string;
  clientId: string;
  businessProfileId?: string | null;
  formationPlanId?: string | null;
  jurisdictionId?: string | null;
  title: string;
  description?: string | null;
  type: ObligationType;
  status: ComplianceStatus;
  dueAt?: Date | null;
  completedAt?: Date | null;
  ownerUserId?: string | null;
  professionalReviewRequired: boolean;
  professionalReviewCompleted: boolean;
  escalationLevel: number;
  createdAt: Date;
  updatedAt: Date;
};

export function isTerminalComplianceStatus(status: ComplianceStatus) {
  return status === "COMPLETE";
}

export function isOverdue(dueAt: Date | null | undefined, now = new Date()) {
  return Boolean(dueAt && dueAt.getTime() < now.getTime());
}

export function calculateComplianceProgress(
  items: ReadonlyArray<{ status: ComplianceStatus | string }>,
) {
  if (!items.length) return 0;

  const complete = items.filter((item) => item.status === "COMPLETE").length;
  return Math.round((complete / items.length) * 100);
}
