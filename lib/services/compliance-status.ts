import { isOverdue, isTerminalComplianceStatus, type ComplianceObligation, type ComplianceStatus } from "../domain/compliance";

export function derivePortfolioStatus(
  obligations: Array<Pick<ComplianceObligation,"status"|"dueAt">>,
  now = new Date(),
): ComplianceStatus | "HEALTHY" {
  if (!obligations.length) return "HEALTHY";
  if (obligations.some(o => o.status === "BLOCKED")) return "BLOCKED";
  if (obligations.some(o => isOverdue(o.dueAt, now) && !isTerminalComplianceStatus(o.status))) return "OVERDUE";
  if (obligations.some(o => o.status === "IN_REVIEW")) return "IN_REVIEW";
  if (obligations.every(o => isTerminalComplianceStatus(o.status))) return "COMPLIANT";
  return "IN_PROGRESS";
}
export function calculateProgress(obligations: Array<Pick<ComplianceObligation,"status">>) {
  if (!obligations.length) return 0;
  const done = obligations.filter(o => ["COMPLIANT","WAIVED","NOT_APPLICABLE"].includes(o.status)).length;
  return Math.round(done / obligations.length * 100);
}
