import type { EvidenceClass } from "./types";

const rank: Record<EvidenceClass, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4 };

export function evidenceRank(value: EvidenceClass): number { return rank[value]; }

export function requiresProfessionalReview(evidenceClass: EvidenceClass, explicitReviewRequired = false): boolean {
  return explicitReviewRequired || evidenceRank(evidenceClass) < evidenceRank("E3");
}
