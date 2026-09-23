export interface JurisdictionCriterion {
  key: string;
  label: string;
  weight: number;
}

export interface JurisdictionObservation {
  jurisdictionId: string;
  criterionKey: string;
  value: number;
  evidenceIds: string[];
  assumptions: string[];
  reviewRequired: boolean;
}

export interface JurisdictionComparison {
  criteria: JurisdictionCriterion[];
  observations: JurisdictionObservation[];
}

export function calculateAnalyticalIndicator(observations: JurisdictionObservation[], criteria: JurisdictionCriterion[], jurisdictionId: string): number {
  const relevant = observations.filter((o) => o.jurisdictionId === jurisdictionId);
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (!totalWeight) return 0;
  return relevant.reduce((sum, observation) => {
    const criterion = criteria.find((c) => c.key === observation.criterionKey);
    return sum + (criterion ? observation.value * criterion.weight : 0);
  }, 0) / totalWeight;
}
