"use client";

import type { EvidenceClass } from "@/lib/domain/jurisdiction";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const labelKeys: Record<EvidenceClass, MessageKey> = {
  E0: "app.evidence.unknown",
  E1: "app.evidence.userProvided",
  E2: "app.evidence.secondary",
  E3: "app.evidence.primary",
  E4: "app.evidence.crossVerified",
};

export function EvidenceBadge({ evidenceClass }: { evidenceClass: EvidenceClass }) {
  const { t } = useLocale();
  return <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium tracking-[0.16em] text-slate-300">{evidenceClass} · {t(labelKeys[evidenceClass])}</span>;
}
