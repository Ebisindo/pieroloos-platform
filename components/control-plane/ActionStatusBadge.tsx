"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ControlActionStatus } from "@/lib/domain/action-control";
import type { MessageKey } from "@/lib/i18n/messages";

const STATUS_KEYS: Record<ControlActionStatus, MessageKey> = {
  OPEN: "app.actions.statusOpen",
  ASSIGNED: "app.actions.statusAssigned",
  IN_PROGRESS: "app.actions.statusInProgress",
  BLOCKED: "app.actions.statusBlocked",
  PENDING_REVIEW: "app.actions.statusPendingReview",
  RESOLVED: "app.actions.statusResolved",
  CANCELLED: "app.actions.statusCancelled",
};

export function ActionStatusBadge({ status }: { status: ControlActionStatus }) {
  const { t } = useLocale();
  return (
    <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-xs uppercase tracking-wider text-white/55">
      {t(STATUS_KEYS[status])}
    </span>
  );
}
