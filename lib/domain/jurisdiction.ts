export const EVIDENCE_CLASSES = ["E0", "E1", "E2", "E3", "E4"] as const;
export type EvidenceClass = typeof EVIDENCE_CLASSES[number];

export type JurisdictionFactor = {
  criterionKey: string;
  value: number | string | boolean | null;
  normalizedScore?: number | null;
  evidenceClass: EvidenceClass;
  sourceIds: string[];
  confidence: number;
  reviewRequired: boolean;
  notes?: string;
};

export type Jurisdiction = {
  id: string;
  code: string;
  name: string;
  region?: string;
  profileSummary?: string;
  factors: JurisdictionFactor[];
};

export type ComparisonCriterion = {
  key: string;
  name: string;
  description: string;
  weight: number;
};

export type JurisdictionComparison = {
  observations: JurisdictionFactor[];
  criteria: ComparisonCriterion[];
};

export const EVIDENCE_CONFIDENCE: Record<EvidenceClass, number> = {
  E0: 0,
  E1: 25,
  E2: 50,
  E3: 75,
  E4: 100,
};

export function evidenceConfidence(c: EvidenceClass) {
  return EVIDENCE_CONFIDENCE[c];
}

export function normalizeWeights(criteria: ComparisonCriterion[]) {
  const total = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);

  if (total <= 0) {
    return criteria.map((criterion) => ({
      ...criterion,
      normalizedWeight: 0,
    }));
  }

  return criteria.map((criterion) => ({
    ...criterion,
    normalizedWeight: criterion.weight / total,
  }));
}

export function calculateAnalyticalIndicator(
  factors: JurisdictionFactor[],
  criteria: ComparisonCriterion[],
) {
  const normalizedCriteria = normalizeWeights(criteria);
  let total = 0;
  let knownWeight = 0;

  for (const criterion of normalizedCriteria) {
    const factor = factors.find((item) => item.criterionKey === criterion.key);
    if (!factor || factor.normalizedScore == null) continue;

    total += factor.normalizedScore * criterion.normalizedWeight;
    knownWeight += criterion.normalizedWeight;
  }

  return knownWeight === 0
    ? null
    : Number((total / knownWeight).toFixed(2));
}

export function calculateConfidence(factors: JurisdictionFactor[]) {
  if (!factors.length) return 0;

  return Math.round(
    factors.reduce((sum, factor) => sum + factor.confidence, 0) / factors.length,
  );
}
