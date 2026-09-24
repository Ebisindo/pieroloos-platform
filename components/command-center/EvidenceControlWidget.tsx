import type { EvidenceAwareControlSummary } from "@/lib/domain/operational-intelligence";

export function EvidenceControlWidget({ summary }: { summary: EvidenceAwareControlSummary }) {
  const metrics = [
    ["Documents", summary.totalDocuments], ["Verified", summary.verifiedDocuments],
    ["In review", summary.documentsInReview], ["Evidence gaps", summary.evidenceGaps],
  ] as const;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.18em] text-white/40">Evidence control</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Evidence-aware operations</h2></div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60">
          {summary.criticalSignals ? "Action required" : "Controlled"}
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
