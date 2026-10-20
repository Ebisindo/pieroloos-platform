import type { ActionPriority, EscalationLevel, OperationalAction } from "./action-control";

export type EscalationPolicy = {
  level: EscalationLevel;
  afterHours: number;
  notifyRoles: string[];
  requireAction: boolean;
};

export const DEFAULT_ESCALATION_POLICIES: EscalationPolicy[] = [
  { level: 1, afterHours: 24, notifyRoles: ["OWNER"], requireAction: true },
  { level: 2, afterHours: 72, notifyRoles: ["OWNER", "MANAGER"], requireAction: true },
  { level: 3, afterHours: 120, notifyRoles: ["OWNER", "MANAGER", "EXECUTIVE"], requireAction: true },
];

export type EscalationAssessment = {
  overdue: boolean;
  nextLevel: EscalationLevel;
  shouldEscalate: boolean;
  reason?: string;
};

function hoursBetween(from: Date, to: Date) {
  return Math.max(0, to.getTime() - from.getTime()) / 3_600_000;
}

export function assessEscalation(
  action: OperationalAction,
  now = new Date(),
  policies = DEFAULT_ESCALATION_POLICIES,
): EscalationAssessment {
  if (["RESOLVED", "CANCELLED"].includes(action.status)) {
    return { overdue: false, nextLevel: action.escalationLevel, shouldEscalate: false };
  }

  if (!action.dueAt || now <= action.dueAt) {
    return { overdue: false, nextLevel: action.escalationLevel, shouldEscalate: false };
  }

  const overdueHours = hoursBetween(action.dueAt, now);
  const next = [...policies]
    .reverse()
    .find(policy => overdueHours >= policy.afterHours && policy.level > action.escalationLevel);

  if (!next) {
    return {
      overdue: true,
      nextLevel: action.escalationLevel,
      shouldEscalate: false,
      reason: "Action is overdue but has reached the current escalation ceiling.",
    };
  }

  return {
    overdue: true,
    nextLevel: next.level,
    shouldEscalate: true,
    reason: `Action has exceeded the ${next.afterHours}-hour escalation threshold.`,
  };
}

export function derivePriorityFromSignalSeverity(
  severity: "INFO" | "ATTENTION" | "CRITICAL",
): ActionPriority {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "ATTENTION") return "HIGH";
  return "NORMAL";
}
