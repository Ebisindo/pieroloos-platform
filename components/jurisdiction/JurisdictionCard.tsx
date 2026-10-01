import Link from "next/link";
import type { Jurisdiction } from "@/lib/domain/jurisdiction";
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
	const evidenceClass = jurisdiction.factors[0]?.evidenceClass;

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
							{jurisdiction.profileSummary || "No profile summary available."}
						</p>
					</div>
					{evidenceClass ? <EvidenceBadge evidenceClass={evidenceClass} /> : null}
				</div>
				<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
					<Link href={`/jurisdictions/${encodeURIComponent(jurisdiction.id)}`} className="text-xs font-medium text-cyan-200 hover:text-cyan-100">
						View details <span aria-hidden="true">-&gt;</span>
					</Link>
					<label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-medium text-slate-200">
						<input
							type="checkbox"
							checked={selected}
							disabled={disabled}
							onChange={() => onSelect(jurisdiction.id)}
							className="h-4 w-4 accent-[#67d9e8]"
							aria-label={`${selected ? "Remove" : "Add"} ${jurisdiction.name} ${selected ? "from" : "to"} comparison`}
						/>
						Compare
					</label>
				</div>
			</article>
	);
}
