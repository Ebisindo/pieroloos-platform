"use client";

import type { ComplianceStatus } from "@/lib/domain/compliance";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const statusKeys: Record<string, MessageKey> = {
  PENDING: "app.status.pending",
  DUE_SOON: "app.status.dueSoon",
  OVERDUE: "app.status.overdue",
  IN_PROGRESS: "app.status.inProgress",
  IN_REVIEW: "app.status.inReview",
  COMPLETE: "app.status.complete",
  COMPLETED: "app.status.completed",
  COMPLIANT: "app.status.compliant",
  WAIVED: "app.status.waived",
  NOT_APPLICABLE: "app.status.notApplicable",
};

export function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  const { t } = useLocale();
  return <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80">
    {statusKeys[status] ? t(statusKeys[status]) : status.replaceAll("_", " ")}
  </span>;
}
