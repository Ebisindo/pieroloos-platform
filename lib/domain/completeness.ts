export interface CompletenessResult {
  score: number;
  completed: number;
  total: number;
  missing: string[];
}

export function calculateBusinessProfileCompleteness(profile: Record<string, unknown>): CompletenessResult {
  const fields = [
    ["Business identity", profile.businessName],
    ["Business model", profile.businessModel],
    ["Target market", profile.targetMarket],
    ["Revenue model", profile.revenueModel],
    ["Ownership", profile.ownership],
    ["Funding stage", profile.fundingStage],
    ["Strategic objectives", profile.expansionObjectives],
  ] as const;

  const completed = fields.filter(([, value]) => typeof value === "string" && value.trim().length > 0).length;
  const missing = fields.filter(([, value]) => !(typeof value === "string" && value.trim().length > 0)).map(([label]) => label);
  const total = fields.length;

  return {
    score: Math.round((completed / total) * 100),
    completed,
    total,
    missing,
  };
}
