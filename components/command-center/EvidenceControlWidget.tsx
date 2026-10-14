"use client";

import type { EvidenceAwareControlSummary } from "@/lib/domain/operational-intelligence";
import { useLocale } from "@/components/i18n/LocaleProvider";

export function EvidenceControlWidget({ summary }: { summary: EvidenceAwareControlSummary }) {
  const { t } = useLocale();
  const metrics = [
    [t("app.dashboard.documents"), summary.totalDocuments], [t("app.dashboard.verified"), summary.verifiedDocuments],
    [t("app.dashboard.inReview"), summary.documentsInReview], [t("app.dashboard.evidenceGaps"), summary.evidenceGaps],
  ] as const;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.18em] text-white/40">{t("app.dashboard.evidenceControl")}</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{t("app.dashboard.evidenceAware")}</h2></div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60">
          {summary.criticalSignals ? t("app.dashboard.actionRequired") : t("app.dashboard.controlled")}
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 p-3">
          <p className="text-xs text-white/40">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p>
        </div>)}
      </div>
    </section>
  );
}
