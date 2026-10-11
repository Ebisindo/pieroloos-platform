import { ShieldAlert } from "lucide-react";
import {
  EVIDENCE_GAP_LABELS,
  PLATFORM_GUIDANCE_NOTICE,
  type EvidenceGapCode,
} from "@/lib/domain/trust-boundary";

export function TrustBoundaryNotice({
  gaps,
  heading = "Platform guidance, not professional advice",
}: {
  gaps?: EvidenceGapCode[];
  heading?: string;
}) {
  return (
    <aside className="trust-notice" aria-label="Information boundary">
      <ShieldAlert size={16} aria-hidden="true" />
      <div>
        <p className="trust-notice-title">{heading}</p>
        <p>{PLATFORM_GUIDANCE_NOTICE}</p>
        {gaps?.length ? (
          <ul>
            {gaps.map((gap) => <li key={gap}>{EVIDENCE_GAP_LABELS[gap]}</li>)}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
