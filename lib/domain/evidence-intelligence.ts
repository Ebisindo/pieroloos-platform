import type { EvidenceDocument, EvidenceClass, DocumentReviewStatus } from "./evidence";

export type EvidenceIntelligenceStatus =
  | "SUFFICIENT"
  | "PARTIAL"
  | "INSUFFICIENT"
  | "REVIEW_REQUIRED"
  | "CONFLICTING";

export type EvidenceIntelligence = {
  obligationId: string;
  status: EvidenceIntelligenceStatus;
  documentCount: number;
  verifiedCount: number;
  strongestEvidenceClass: EvidenceClass;
  confidence: number;
  missing: string[];
  warnings: string[];
};

const classRank: Record<EvidenceClass, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4 };

export function assessEvidence(
  obligationId: string,
  documents: EvidenceDocument[],
): EvidenceIntelligence {
  const relevant = documents.filter(d => d.complianceObligationId === obligationId);
  const verified = relevant.filter(d => d.reviewStatus === "VERIFIED");
  const strongest = relevant.reduce<EvidenceClass>(
    (best, item) => classRank[item.evidenceClass] > classRank[best] ? item.evidenceClass : best,
    "E0",
  );

  const missing: string[] = [];
  const warnings: string[] = [];

  if (!relevant.length) missing.push("Supporting document");
  if (relevant.length && !verified.length) missing.push("Verified review");
  if (strongest === "E0") warnings.push("Evidence class is unknown");
  if (relevant.some(d => d.reviewStatus === "REJECTED")) warnings.push("Rejected evidence exists");
  if (relevant.some(d => d.reviewStatus === "SUPERSEDED")) warnings.push("Superseded versions exist");

  let status: EvidenceIntelligenceStatus = "INSUFFICIENT";
  if (missing.length === 0 && strongest === "E4") status = "SUFFICIENT";
  else if (verified.length > 0 && strongest >= "E2") status = "PARTIAL";
  else if (relevant.length > 0) status = "REVIEW_REQUIRED";

  const confidence = relevant.length
    ? Math.max(...relevant.map(d => d.confidence))
    : 0;

  return {
    obligationId,
    status,
    documentCount: relevant.length,
    verifiedCount: verified.length,
    strongestEvidenceClass: strongest,
    confidence,
    missing,
    warnings,
  };
}

export function reviewStatusRequiresHumanDecision(status: DocumentReviewStatus) {
  return status === "IN_REVIEW" || status === "REJECTED";
}
