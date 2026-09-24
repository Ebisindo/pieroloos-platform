import type { EvidenceDocument } from "@/lib/domain/evidence";
import { assessEvidence } from "@/lib/domain/evidence-intelligence";

export function buildReportEvidenceSection(obligationId: string, documents: EvidenceDocument[]) {
  const intelligence = assessEvidence(obligationId, documents);
  const verifiedDocuments = documents
    .filter(d => d.complianceObligationId === obligationId && d.reviewStatus === "VERIFIED")
    .map(d => ({ id: d.id, name: d.name, version: d.version, reviewStatus: d.reviewStatus, contentHash: d.contentHash }));
  return {
    obligationId,
    status: intelligence.status,
    confidence: intelligence.confidence,
    strongestEvidenceClass: intelligence.strongestEvidenceClass,
    verifiedDocuments,
    limitations: [...intelligence.missing, ...intelligence.warnings],
  };
}
