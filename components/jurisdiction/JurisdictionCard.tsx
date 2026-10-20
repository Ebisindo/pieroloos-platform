"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Jurisdiction } from "@/lib/domain/jurisdiction";
import { weakestEvidenceClass } from "@/lib/domain/trust-boundary";
import { EvidenceBadge } from "./EvidenceBadge";

export function JurisdictionCard({
	jurisdiction,
	selected,
	onSelect,
	disabled,
}: {
	jurisdiction: Jurisdiction;
	selected: boolean;
	onSelect: (id: string) => void;
	disabled?: boolean;
}) {
	const { t } = useLocale();
	// Show the weakest factor so a strong record cannot mask weak or missing evidence.
	const evidenceClass = weakestEvidenceClass(jurisdiction.factors.map((factor) => factor.evidenceClass));

	return (
			<article className={`h-full rounded-lg border p-5 transition-colors ${selected ? "border-cyan-300/40 bg-cyan-300/[0.06]" : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]"}`}>
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">{jurisdiction.code}</p>
						<h2 className="mt-2 text-lg font-semibold text-white">
							<Link href={`/jurisdictions/${encodeURIComponent(jurisdiction.id)}`} className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
								{jurisdiction.name}
							</Link>
						</h2>
						<p className="mt-2 text-sm leading-6 text-slate-400">
							{jurisdiction.profileSummary || t("app.jurisdiction.profileSummaryMissing")}
						</p>
					</div>
					<div className="flex flex-col items-end gap-1 text-right">
						<EvidenceBadge evidenceClass={evidenceClass} />
						<span className="text-[10px] text-slate-400">
							{jurisdiction.factors.length ? t("app.jurisdiction.weakestEvidence") : t("app.jurisdiction.noEvidence")}
						</span>
					</div>
				</div>
				<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
					<Link href={`/jurisdictions/${encodeURIComponent(jurisdiction.id)}`} className="text-xs font-medium text-cyan-200 hover:text-cyan-100">
						{t("app.jurisdiction.viewDetails")} <span aria-hidden="true">-&gt;</span>
					</Link>
					<label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-medium text-slate-200">
						<input
							type="checkbox"
							checked={selected}
							disabled={disabled}
							onChange={() => onSelect(jurisdiction.id)}
							className="h-4 w-4 accent-[#67d9e8]"
							aria-label={`${t(selected ? "app.jurisdiction.removeFromComparison" : "app.jurisdiction.addToComparison")} ${jurisdiction.name}`}
						/>
						{t("app.jurisdiction.compareLabel")}
					</label>
				</div>
			</article>
	);
}
