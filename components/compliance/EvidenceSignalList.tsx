import type { OperationalSignal } from "@/lib/domain/operational-intelligence";

export function EvidenceSignalList({ signals }: { signals: OperationalSignal[] }) {
  if (!signals.length) return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
    <p className="text-sm text-white/60">No evidence control signals.</p>
  </div>;
  return <section className="space-y-2">{signals.map(signal => <article key={signal.id}
    className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-medium text-white">{signal.title}</h3>
      <span className="text-xs uppercase tracking-wider text-white/40">{signal.severity}</span>
    </div>
    <p className="mt-1 text-sm text-white/55">{signal.description}</p>
  </article>)}</section>;
}
