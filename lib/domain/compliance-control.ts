import type { ComplianceStatus } from "./compliance";

export type ComplianceUrgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type ComplianceAlert = {
  id: string;
  obligationId: string;
  clientId: string;
  title: string;
  urgency: ComplianceUrgency;
  status: ComplianceStatus;
  dueAt: Date | null;
  daysUntilDue: number | null;
  requiresEvidence: boolean;
  requiresProfessionalReview: boolean;
  escalationLevel: number;
};

export type ComplianceControlSnapshot = {
  generatedAt: Date;
  portfolioStatus: ComplianceStatus | "HEALTHY";
  progressPercent: number;
  totals: {
    obligations: number;
    compliant: number;
    dueSoon: number;
    overdue: number;
    blocked: number;
    awaitingEvidence: number;
    awaitingReview: number;
  };
  alerts: ComplianceAlert[];
};

export function daysUntil(date: Date | null | undefined, now = new Date()) {
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

export function classifyUrgency(
  status: ComplianceStatus,
  dueAt: Date | null | undefined,
  now = new Date(),
): ComplianceUrgency {
  if (status === "BLOCKED" || status === "OVERDUE") return "CRITICAL";
  const days = daysUntil(dueAt, now);
  if (days == null) return "NONE";
  if (days <= 3) return "HIGH";
  if (days <= 14) return "MEDIUM";
  if (days <= 30) return "LOW";
  return "NONE";
}

export function buildComplianceControlSnapshot(
  obligations: Array<{
    id: string; clientId: string; title: string; status: ComplianceStatus;
    dueAt?: Date | null; requiresEvidence?: boolean;
    requiresProfessionalReview?: boolean; escalationLevel?: number;
  }>,
  now = new Date(),
): ComplianceControlSnapshot {
  const alerts: ComplianceAlert[] = obligations.map(o => {
    const days = daysUntil(o.dueAt, now);
    const terminal = ["COMPLIANT", "WAIVED", "NOT_APPLICABLE"].includes(o.status);
    const overdue = days !== null && days < 0 && !terminal;
    const status = overdue ? "OVERDUE" as const : o.status;
    return {
      id: `alert:${o.id}`,
      obligationId: o.id,
      clientId: o.clientId,
      title: o.title,
      urgency: classifyUrgency(status, o.dueAt, now),
      status,
      dueAt: o.dueAt ?? null,
      daysUntilDue: days,
      requiresEvidence: Boolean(o.requiresEvidence),
      requiresProfessionalReview: Boolean(o.requiresProfessionalReview),
      escalationLevel: o.escalationLevel ?? 0,
    };
  }).filter(a =>
    a.urgency !== "NONE" ||
    a.status === "AWAITING_EVIDENCE" ||
    a.status === "IN_REVIEW"
  );

  const compliant = obligations.filter(o =>
    ["COMPLIANT", "WAIVED", "NOT_APPLICABLE"].includes(o.status)
  ).length;
  const overdue = alerts.filter(a => a.status === "OVERDUE").length;
  const blocked = obligations.filter(o => o.status === "BLOCKED").length;
  const awaitingEvidence = obligations.filter(o => o.status === "AWAITING_EVIDENCE").length;
  const awaitingReview = obligations.filter(o => o.status === "IN_REVIEW").length;
  const dueSoon = obligations.filter(o => {
    const d = daysUntil(o.dueAt, now);
    return d !== null && d >= 0 && d <= 30 &&
      !["COMPLIANT", "WAIVED", "NOT_APPLICABLE"].includes(o.status);
  }).length;

  let portfolioStatus: ComplianceControlSnapshot["portfolioStatus"] = "HEALTHY";
  if (blocked) portfolioStatus = "BLOCKED";
  else if (overdue) portfolioStatus = "OVERDUE";
  else if (awaitingReview) portfolioStatus = "IN_REVIEW";
  else if (obligations.length && compliant === obligations.length) portfolioStatus = "COMPLIANT";
  else if (obligations.length) portfolioStatus = "IN_PROGRESS";

  return {
    generatedAt: now,
    portfolioStatus,
    progressPercent: obligations.length ? Math.round(compliant / obligations.length * 100) : 0,
    totals: { obligations: obligations.length, compliant, dueSoon, overdue, blocked, awaitingEvidence, awaitingReview },
    alerts: alerts.sort((a, b) => {
      const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };
      return rank[a.urgency] - rank[b.urgency];
    }),
  };
}
