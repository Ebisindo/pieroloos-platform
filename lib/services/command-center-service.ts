import { buildEvidenceAwareControlSummary, buildOperationalSignals } from "@/lib/domain/operational-intelligence";
import type { EvidenceDocument } from "@/lib/domain/evidence";

export function buildCommandCenterSnapshot(input: { documents: EvidenceDocument[]; obligationIds: string[] }) {
  const evidence = buildEvidenceAwareControlSummary(input.documents, input.obligationIds);
  const signals = buildOperationalSignals(input.documents, evidence.intelligence);
  const health = evidence.criticalSignals > 0
    ? { state: "DEGRADED" as const, explanation: "Critical evidence or compliance control signals require action." }
    : evidence.attentionSignals > 0
      ? { state: "ATTENTION" as const, explanation: "Operational review items are awaiting action." }
      : { state: "OPERATIONAL" as const, explanation: "No critical evidence control signals are currently detected." };
  return { generatedAt: new Date(), evidence, signals, health };
}
