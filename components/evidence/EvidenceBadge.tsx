import type { EvidenceClass } from "@/lib/domain/evidence";
import { evidenceClassLabel } from "@/lib/domain/evidence";

export function EvidenceBadge({ value }: { value: EvidenceClass }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
      {value} · {evidenceClassLabel(value)}
    </span>
  );
}
