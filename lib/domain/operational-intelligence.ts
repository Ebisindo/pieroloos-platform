import type { EvidenceDocument } from "./evidence";
import { assessEvidence, type EvidenceIntelligence } from "./evidence-intelligence";

export type OperationalSignalSeverity = "INFO" | "ATTENTION" | "CRITICAL";
export type OperationalSignal = {
  id: string;
  type: "EVIDENCE_GAP" | "REVIEW_REQUIRED" | "INTEGRITY_CONFLICT" | "SUPERSEDED_EVIDENCE" | "COMPLIANCE_RISK";
  severity: OperationalSignalSeverity;
  title: string;
  description: string;
  entityId?: string;
  obligationId?: string;
  createdAt: Date;
};

export type EvidenceAwareControlSummary = {
  totalDocuments: number;
  verifiedDocuments: number;
  documentsInReview: number;
  rejectedDocuments: number;
  supersededDocuments: number;
  evidenceGaps: number;
  criticalSignals: number;
  attentionSignals: number;
  intelligence: EvidenceIntelligence[];
};

export function buildEvidenceAwareControlSummary(documents: EvidenceDocument[], obligationIds: string[]): EvidenceAwareControlSummary {
  const intelligence = obligationIds.map(id => assessEvidence(id, documents));
  const signals = buildOperationalSignals(documents, intelligence);
  return {
    totalDocuments: documents.length,
    verifiedDocuments: documents.filter(d => d.reviewStatus === "VERIFIED").length,
    documentsInReview: documents.filter(d => d.reviewStatus === "IN_REVIEW").length,
    rejectedDocuments: documents.filter(d => d.reviewStatus === "REJECTED").length,
    supersededDocuments: documents.filter(d => d.reviewStatus === "SUPERSEDED").length,
    evidenceGaps: intelligence.filter(i => i.status === "INSUFFICIENT").length,
    criticalSignals: signals.filter(s => s.severity === "CRITICAL").length,
    attentionSignals: signals.filter(s => s.severity === "ATTENTION").length,
    intelligence,
  };
}

export function buildOperationalSignals(documents: EvidenceDocument[], intelligence: EvidenceIntelligence[]): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  for (const item of intelligence) {
    if (item.status === "INSUFFICIENT") signals.push({
      id: `evidence-gap:${item.obligationId}`, type: "EVIDENCE_GAP", severity: "CRITICAL",
      title: "Evidence gap detected", description: item.missing.join("; ") || "Required evidence is incomplete.",
      obligationId: item.obligationId, createdAt: new Date(),
    });
    if (item.status === "REVIEW_REQUIRED") signals.push({
      id: `review:${item.obligationId}`, type: "REVIEW_REQUIRED", severity: "ATTENTION",
      title: "Evidence review required", description: "Evidence exists but has not reached a verified state.",
      obligationId: item.obligationId, createdAt: new Date(),
    });
  }
  for (const document of documents) {
    if (document.reviewStatus === "REJECTED") signals.push({
      id: `rejected:${document.id}`, type: "INTEGRITY_CONFLICT", severity: "CRITICAL",
      title: "Rejected evidence", description: `${document.name} requires replacement or corrective action.`,
      entityId: document.id, obligationId: document.complianceObligationId ?? undefined, createdAt: new Date(),
    });
    if (document.reviewStatus === "SUPERSEDED") signals.push({
      id: `superseded:${document.id}`, type: "SUPERSEDED_EVIDENCE", severity: "INFO",
      title: "Superseded evidence", description: `${document.name} is no longer the active document version.`,
      entityId: document.id, obligationId: document.complianceObligationId ?? undefined, createdAt: new Date(),
    });
  }
  return signals;
}
