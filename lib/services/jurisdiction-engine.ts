import {
  calculateAnalyticalIndicator,
  calculateConfidence,
  type ComparisonCriterion,
  type Jurisdiction,
} from "@/lib/domain/jurisdiction";
import {
  comparisonRequestSchema,
  type ComparisonRequest,
} from "@/lib/validation/jurisdiction";

export function compareJurisdictions(
  input: ComparisonRequest,
  jurisdictions: Jurisdiction[],
) {
  const request = comparisonRequestSchema.parse(input);

  return request.jurisdictionIds.map((id) => {
    const jurisdiction = jurisdictions.find((item) => item.id === id);

    if (!jurisdiction) {
      throw new Error(`Jurisdiction not found: ${id}`);
    }

    const indicator = calculateAnalyticalIndicator(
      jurisdiction.factors,
      request.criteria as ComparisonCriterion[],
    );

    return {
      jurisdictionId: id,
      analyticalIndicator: indicator,
      confidence: calculateConfidence(jurisdiction.factors),
      professionalReviewRequired:
        indicator === null ||
        jurisdiction.factors.some((factor) => factor.reviewRequired),
      methodologyVersion: request.methodologyVersion,
    };
  });
}
