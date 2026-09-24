import { assessEvidence } from "../domain/evidence-intelligence";
import type { EvidenceDocument as StoredDocument } from "../domain/evidence";

export function buildObligationEvidenceView(
  obligationId: string,
  documents: StoredDocument[],
) {
  return assessEvidence(obligationId, documents);
}

export function buildEvidencePortfolio(documents: StoredDocument[]) {
  const obligationIds = [
    ...new Set(documents.map((document) => document.complianceObligationId).filter(Boolean)),
  ] as string[];

  return obligationIds.map((id) => assessEvidence(id, documents));
}
