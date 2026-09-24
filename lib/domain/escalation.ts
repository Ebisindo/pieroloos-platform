import type { ComplianceAlert } from "./compliance-control";

export type EscalationPolicy = {
  id: string;
  name: string;
  enabled: boolean;
  overdueAfterDays: number;
  maxLevel: number;
  notifyChannels: Array<"IN_APP" | "EMAIL">;
};

export type EscalationDecision = {
  shouldEscalate: boolean;
  nextLevel: number;
  reason: string;
};

export function evaluateEscalation(
  alert: ComplianceAlert,
  policy: EscalationPolicy,
): EscalationDecision {
  if (!policy.enabled) {
    return { shouldEscalate: false, nextLevel: alert.escalationLevel, reason: "Policy disabled" };
  }
  if (alert.escalationLevel >= policy.maxLevel) {
    return { shouldEscalate: false, nextLevel: alert.escalationLevel, reason: "Maximum escalation level reached" };
  }
  if (alert.status === "BLOCKED") {
    return { shouldEscalate: true, nextLevel: alert.escalationLevel + 1, reason: "Obligation is blocked" };
  }
  if (alert.daysUntilDue !== null && alert.daysUntilDue < -policy.overdueAfterDays) {
    return { shouldEscalate: true, nextLevel: alert.escalationLevel + 1, reason: "Obligation exceeded escalation threshold" };
  }
  if (alert.requiresProfessionalReview && alert.status === "IN_REVIEW") {
    return { shouldEscalate: true, nextLevel: alert.escalationLevel + 1, reason: "Professional review remains unresolved" };
  }
  return { shouldEscalate: false, nextLevel: alert.escalationLevel, reason: "No escalation condition met" };
}
