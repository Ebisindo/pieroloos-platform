"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatNumber, messageCatalogs, type MessageKey } from "@/lib/i18n/messages";
import type { EvidenceDocument } from "@/lib/domain/evidence";
import { EvidenceBadge } from "./EvidenceBadge";
import { assessEvidence } from "@/lib/domain/evidence-intelligence";

export function DocumentEvidencePanel({
  obligationId,
  documents,
}: {
  obligationId: string;
  documents: EvidenceDocument[];
}) {
  const { locale, t } = useLocale();
  const intelligence = assessEvidence(obligationId, documents);
  const itemText = (item: string) => {
    const key = `evidencePanel.item.${item}`;
    return key in messageCatalogs.en ? t(key as MessageKey) : item;
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">{t("evidencePanel.eyebrow")}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{t("evidencePanel.title")}</h2>
        </div>
        <EvidenceBadge value={intelligence.strongestEvidenceClass} />
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label={t("evidencePanel.documents")} value={intelligence.documentCount} />
        <Metric label={t("evidencePanel.verified")} value={intelligence.verifiedCount} />
        <Metric label={t("evidencePanel.confidence")} value={formatNumber(intelligence.confidence, locale, { style: "percent", maximumFractionDigits: 0 })} />
        <Metric label={t("evidencePanel.status")} value={t(`evidencePanel.status.${intelligence.status}` as MessageKey)} />
      </div>

      {(intelligence.missing.length > 0 || intelligence.warnings.length > 0) && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-4">
          {intelligence.missing.map(item => (
            <p key={item} className="text-sm text-white/65">{t("evidencePanel.missing", { item: itemText(item) })}</p>
          ))}
          {intelligence.warnings.map(item => (
            <p key={item} className="text-sm text-white/50">{t("evidencePanel.warning", { item: itemText(item) })}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
