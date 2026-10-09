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
  authoritativeSources?: AuthoritativeSource[];
  rules?: JurisdictionRule[];
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

export const JURISDICTION_SOURCE_TYPES = [
  "STATUTE",
  "REGULATION",
  "GUIDANCE",
  "OFFICIAL_NOTICE",
  "JUDGMENT",
  "INDUSTRY_STANDARD",
  "INTERNAL_POLICY",
] as const;
export type JurisdictionSourceType = typeof JURISDICTION_SOURCE_TYPES[number];

export const JURISDICTION_SUPERSESSION_STATES = [
  "ACTIVE",
  "SUPERSEDED",
  "REPLACED",
  "REVOKED",
  "DRAFT",
] as const;
export type JurisdictionSupersessionState = typeof JURISDICTION_SUPERSESSION_STATES[number];

export type AuthoritativeSource = {
  id: string;
  jurisdictionId: string;
  jurisdictionCode?: string | null;
  title: string;
  sourceType: JurisdictionSourceType;
  issuingAuthority: string;
  sourceUrl?: string | null;
  publicationDate?: Date | null;
  effectiveDate?: Date | null;
  retrievalDate: Date;
  confidence: number;
  evidenceClass: EvidenceClass;
  reviewerUserId?: string | null;
  reviewStatus: "UNREVIEWED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "SUPERSEDED";
  supersessionState: JurisdictionSupersessionState;
  supersededBySourceId?: string | null;
  notes?: string | null;
};

export type JurisdictionRule = {
  id: string;
  jurisdictionId: string;
  sourceId: string;
  title: string;
  description?: string | null;
  publicationDate?: Date | null;
  effectiveDate?: Date | null;
  retrievalDate?: Date | null;
  confidence: number;
  evidenceClass: EvidenceClass;
  reviewerUserId?: string | null;
  supersessionState: JurisdictionSupersessionState;
  supersededByRuleId?: string | null;
  active: boolean;
};

export type JurisdictionObligation = {
  id: string;
  jurisdictionId: string;
  sourceId: string;
  ruleId?: string | null;
  title: string;
  obligationType: string;
  description?: string | null;
  publicationDate?: Date | null;
  effectiveDate?: Date | null;
  retrievalDate?: Date | null;
  confidence: number;
  evidenceClass: EvidenceClass;
  reviewerUserId?: string | null;
  supersessionState: JurisdictionSupersessionState;
  active: boolean;
};

export const AFRICAN_JURISDICTION_COVERAGE = [
  { code: "NG", name: "Nigeria", region: "West Africa", focus: ["company formation", "tax", "banking", "licensing"] },
  { code: "GH", name: "Ghana", region: "West Africa", focus: ["company formation", "tax", "data protection"] },
  { code: "KE", name: "Kenya", region: "East Africa", focus: ["company formation", "tax", "banking", "employment"] },
  { code: "RW", name: "Rwanda", region: "East Africa", focus: ["company formation", "tax", "data protection", "digital services"] },
  { code: "ZA", name: "South Africa", region: "Southern Africa", focus: ["company formation", "tax", "corporate governance", "employment"] },
  { code: "CI", name: "Côte d’Ivoire", region: "West Africa", focus: ["company formation", "tax", "trade", "licensing"] },
] as const;

export function evidenceConfidence(c: EvidenceClass) {
  return EVIDENCE_CONFIDENCE[c];
}

export function isActiveJurisdictionSource(
  source: Pick<AuthoritativeSource, "effectiveDate" | "publicationDate" | "supersessionState">,
  asOf = new Date(),
) {
  const effectiveDate = source.effectiveDate ?? source.publicationDate;
  if (source.supersessionState === "DRAFT" || source.supersessionState === "SUPERSEDED" || source.supersessionState === "REVOKED") {
    return false;
  }

  if (effectiveDate && effectiveDate.getTime() > asOf.getTime()) {
    return false;
  }

  return true;
}

export function resolveActiveRules<T extends Pick<JurisdictionRule, "effectiveDate" | "publicationDate" | "supersessionState" | "active">>(
  rules: T[],
  asOf = new Date(),
): T[] {
  return rules.filter((rule) => {
    if (rule.active === false) return false;
    if (rule.supersessionState === "DRAFT" || rule.supersessionState === "SUPERSEDED" || rule.supersessionState === "REVOKED") {
      return false;
    }

    const effectiveDate = rule.effectiveDate ?? rule.publicationDate;
    return !(effectiveDate && effectiveDate.getTime() > asOf.getTime());
  });
}

export function summarizeAuthorityCoverage(sources: Pick<AuthoritativeSource, "jurisdictionId" | "supersessionState" | "effectiveDate" | "publicationDate">[]) {
  const active = sources.filter((source) => isActiveJurisdictionSource(source)).length;
  const superseded = sources.filter((source) => source.supersessionState === "SUPERSEDED" || source.supersessionState === "REPLACED").length;
  const byJurisdiction = sources.reduce<Record<string, number>>((accumulator, source) => {
    accumulator[source.jurisdictionId] = (accumulator[source.jurisdictionId] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    total: sources.length,
    active,
    superseded,
    byJurisdiction,
  };
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
