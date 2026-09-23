import type { ComplianceStatus } from "@prisma/client";

export function calculateComplianceProgress(items: Array<{ status: ComplianceStatus }>): number {
  if (!items.length) return 0;
  const complete = items.filter((item) => item.status === "COMPLETE").length;
  return Math.round((complete / items.length) * 100);
}

export function isComplianceBlocked(items: Array<{ status: ComplianceStatus }>): boolean {
  return items.some((item) => item.status === "BLOCKED");
}
