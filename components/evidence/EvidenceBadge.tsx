"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import type { EvidenceClass } from "@/lib/domain/evidence";
import type { MessageKey } from "@/lib/i18n/messages";

export function EvidenceBadge({ value }: { value: EvidenceClass }) {
  const { t } = useLocale();
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
      {value} · {t(`evidencePanel.class.${value}` as MessageKey)}
    </span>
  );
}
