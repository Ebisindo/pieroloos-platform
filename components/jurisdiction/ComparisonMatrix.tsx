"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatNumber } from "@/lib/i18n/messages";

type Result = { jurisdictionId: string; analyticalIndicator: number | null; confidence: number; professionalReviewRequired: boolean };

export function ComparisonMatrix({ results, names }: { results: Result[]; names: Record<string, string> }) {
  const { locale, t } = useLocale();
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-[680px] w-full text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-5 py-4">{t("app.jurisdiction.name")}</th>
            <th className="px-5 py-4">{t("app.jurisdiction.indicator")}</th>
            <th className="px-5 py-4">{t("app.jurisdiction.confidence")}</th>
            <th className="px-5 py-4">{t("app.jurisdiction.review")}</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.jurisdictionId} className="border-b border-white/5 last:border-0">
              <td className="px-5 py-4 font-medium text-white">{names[r.jurisdictionId] ?? r.jurisdictionId}</td>
              <td className="px-5 py-4 text-cyan-200">{r.analyticalIndicator == null ? t("app.jurisdiction.unknown") : formatNumber(r.analyticalIndicator, locale)}</td>
              <td className="px-5 py-4 text-slate-300">{formatNumber(r.confidence, locale)}%</td>
              <td className="px-5 py-4 text-xs text-amber-300">{r.professionalReviewRequired ? t("app.jurisdiction.reviewRequired") : t("app.jurisdiction.notFlagged")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
