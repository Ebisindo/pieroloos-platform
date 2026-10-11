"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";

export function IntakeClassificationLegend() {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-200">{t("intake.classification.FACT")}</span>
      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-200">{t("intake.classification.ASSUMPTION")}</span>
      <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1 text-rose-200">{t("intake.classification.UNRESOLVED")}</span>
    </div>
  );
}
