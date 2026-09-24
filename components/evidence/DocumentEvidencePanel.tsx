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
  const intelligence = assessEvidence(obligationId, documents);

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Evidence intelligence</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Persistent evidence record</h2>
        </div>
        <EvidenceBadge value={intelligence.strongestEvidenceClass} />
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Documents" value={intelligence.documentCount} />
        <Metric label="Verified" value={intelligence.verifiedCount} />
        <Metric label="Confidence" value={`${Math.round(intelligence.confidence * 100)}%`} />
        <Metric label="Status" value={intelligence.status.replaceAll("_", " ")} />
      </div>

      {(intelligence.missing.length > 0 || intelligence.warnings.length > 0) && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-4">
          {intelligence.missing.map(item => (
            <p key={item} className="text-sm text-white/65">Missing: {item}</p>
          ))}
          {intelligence.warnings.map(item => (
            <p key={item} className="text-sm text-white/50">Warning: {item}</p>
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
