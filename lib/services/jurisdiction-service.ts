import {
  calculateAnalyticalIndicator,
  calculateConfidence,
  type ComparisonCriterion,
  type Jurisdiction,
} from "@/lib/domain/jurisdiction";

export function compareJurisdiction(
  jurisdictions: Jurisdiction[],
  criteria: ComparisonCriterion[],
  jurisdictionIds: string[],
) {
  return jurisdictionIds.map((jurisdictionId) => {
    const jurisdiction = jurisdictions.find((item) => item.id === jurisdictionId);

    if (!jurisdiction) {
      throw new Error(`Jurisdiction not found: ${jurisdictionId}`);
    }

    const indicator = calculateAnalyticalIndicator(
      jurisdiction.factors,
      criteria,
    );

    return {
      jurisdictionId,
      indicator,
      confidence: calculateConfidence(jurisdiction.factors),
      reviewRequired:
        indicator === null ||
        jurisdiction.factors.some((factor) => factor.reviewRequired),
    };
  });
}
