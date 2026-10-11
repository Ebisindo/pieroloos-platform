"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const labels: Record<string, string> = {
  DRAFT: "app.status.draft",
  READY: "app.status.ready",
  IN_PROGRESS: "app.status.inProgress",
  BLOCKED: "app.status.blocked",
  COMPLETED: "app.status.completed",
  CANCELLED: "app.status.cancelled",
  PENDING: "app.status.pending",
  IN_REVIEW: "app.status.inReview",
  WAIVED: "app.status.waived",
  SKIPPED: "app.status.skipped",
};

export function FormationStatusBadge({ status }: { status: string }) {
  const { t } = useLocale();
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-300">
      {status in labels ? t(labels[status] as MessageKey) : status.replaceAll("_", " ")}
    </span>
  );
}
