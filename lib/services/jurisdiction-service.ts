import { calculateAnalyticalIndicator, type JurisdictionComparison } from "../domain/jurisdiction";

export function compareJurisdiction(input: JurisdictionComparison, jurisdictionIds: string[]) {
  return jurisdictionIds.map((jurisdictionId) => ({
    jurisdictionId,
    indicator: calculateAnalyticalIndicator(input.observations, input.criteria, jurisdictionId),
    reviewRequired: input.observations.some((o) => o.jurisdictionId === jurisdictionId && o.reviewRequired),
  }));
}
