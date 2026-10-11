import { isActiveJurisdictionSource, type JurisdictionFactor } from "@/lib/domain/jurisdiction";
import { evidenceRank, requiresProfessionalReview } from "@/lib/evidence/policy";
import type { EvidenceClass } from "@/lib/evidence/types";

export const PLATFORM_GUIDANCE_NOTICE =
  "Platform-generated information organises and summarises records for human review. It is not legal, tax, accounting or financial advice, and it does not guarantee incorporation, registration, approval or compliance.";

export const SOURCE_SUPPORTED_NOTICE =
  "Supported by at least one verified, in-force source retrieved on a recorded date. This is still information, not professional advice; confirm against the source before relying on it.";

export const UNVERIFIED_NOTICE =
  "No verified, in-force source supports this information. Treat it as unverified guidance and do not rely on it as a statement of the rules.";

export const INFORMATION_BASES = ["PLATFORM_GUIDANCE", "SOURCE_SUPPORTED"] as const;
export type InformationBasis = (typeof INFORMATION_BASES)[number];

export const EVIDENCE_GAP_CODES = [
  "NO_EVIDENCE",
  "NO_SOURCE",
  "SOURCE_UNVERIFIED",
  "SOURCE_NOT_IN_FORCE",
  "MISSING_RETRIEVAL_DATE",
  "EVIDENCE_BELOW_PRIMARY",
] as const;
export type EvidenceGapCode = (typeof EVIDENCE_GAP_CODES)[number];

export const EVIDENCE_GAP_LABELS: Record<EvidenceGapCode, string> = {
  NO_EVIDENCE: "No evidence recorded (E0).",
  NO_SOURCE: "No source is linked to this information.",
  SOURCE_UNVERIFIED: "Linked sources have not been verified.",
  SOURCE_NOT_IN_FORCE: "Linked sources are draft, superseded, revoked or not yet in force.",
  MISSING_RETRIEVAL_DATE: "Linked sources have no recorded retrieval date.",
  EVIDENCE_BELOW_PRIMARY: "Evidence is below primary level (E3).",
};

// Platform policy, not legal advice: matters in these areas are always routed to a qualified professional.
export const HIGH_RISK_TOPICS = [
  "TAX",
  "LICENSING_REGULATED_ACTIVITY",
  "CROSS_BORDER_STRUCTURING",
  "SANCTIONS_AML",
  "SECURITIES_FUNDRAISING",
  "LITIGATION_DISPUTE",
] as const;
export type HighRiskTopic = (typeof HIGH_RISK_TOPICS)[number];

export type TrustSourceReference = {
  reviewStatus: "UNREVIEWED" | "UNDER_REVIEW" | "IN_REVIEW" | "VERIFIED" | "REJECTED" | "SUPERSEDED";
  supersessionState?: "ACTIVE" | "SUPERSEDED" | "REPLACED" | "REVOKED" | "DRAFT" | null;
  publicationDate?: Date | null;
  effectiveDate?: Date | null;
  retrievalDate?: Date | null;
};

export type InformationBasisInput = {
  evidenceClass: EvidenceClass;
  sources: TrustSourceReference[];
  topics?: HighRiskTopic[];
};

export type InformationBasisAssessment = {
  basis: InformationBasis;
  gaps: EvidenceGapCode[];
  professionalReviewRequired: boolean;
  escalationTopics: HighRiskTopic[];
  notice: string;
};

export function weakestEvidenceClass(classes: EvidenceClass[]): EvidenceClass {
  if (classes.length === 0) return "E0";
  return classes.reduce((weakest, current) => (evidenceRank(current) < evidenceRank(weakest) ? current : weakest));
}

export function classifyInformationBasis(
  input: InformationBasisInput,
  asOf = new Date(),
): InformationBasisAssessment {
  const gaps: EvidenceGapCode[] = [];
  const rank = evidenceRank(input.evidenceClass);

  if (input.evidenceClass === "E0") gaps.push("NO_EVIDENCE");
  else if (rank < evidenceRank("E3")) gaps.push("EVIDENCE_BELOW_PRIMARY");

  const verified = input.sources.filter((source) => source.reviewStatus === "VERIFIED");
  const inForce = verified.filter((source) =>
    isActiveJurisdictionSource({
      effectiveDate: source.effectiveDate,
      publicationDate: source.publicationDate,
      supersessionState: source.supersessionState ?? "ACTIVE",
    }, asOf));
  const usable = inForce.filter((source) => source.retrievalDate instanceof Date && !Number.isNaN(source.retrievalDate.getTime()));

  if (input.sources.length === 0) gaps.push("NO_SOURCE");
  else if (verified.length === 0) gaps.push("SOURCE_UNVERIFIED");
  else if (inForce.length === 0) gaps.push("SOURCE_NOT_IN_FORCE");
  else if (usable.length === 0) gaps.push("MISSING_RETRIEVAL_DATE");

  const basis: InformationBasis = usable.length > 0 && rank >= evidenceRank("E3")
    ? "SOURCE_SUPPORTED"
    : "PLATFORM_GUIDANCE";
  const escalationTopics = [...new Set(input.topics ?? [])];

  return {
    basis,
    gaps,
    escalationTopics,
    professionalReviewRequired:
      basis !== "SOURCE_SUPPORTED" || requiresProfessionalReview(input.evidenceClass, escalationTopics.length > 0),
    notice: basis === "SOURCE_SUPPORTED" ? SOURCE_SUPPORTED_NOTICE : UNVERIFIED_NOTICE,
  };
}

// Shared by the comparison engine and service so evidence level, not only a stored flag, drives review.
export function factorsRequireProfessionalReview(
  factors: Pick<JurisdictionFactor, "evidenceClass" | "reviewRequired">[],
): boolean {
  if (factors.length === 0) return true;
  return factors.some((factor) => requiresProfessionalReview(factor.evidenceClass, factor.reviewRequired));
}

export const FEATURE_MATURITY_LEVELS = ["IMPLEMENTED", "PARTIAL", "PREPARED", "PLANNED"] as const;
export type FeatureMaturity = (typeof FEATURE_MATURITY_LEVELS)[number];

export type TrustFeature = {
  key: string;
  label: string;
  maturity: FeatureMaturity;
  requiresProfessionalReview: boolean;
  note: string;
};

// Maintained by hand from the code audit; update when a capability's real state changes.
export const TRUST_FEATURES: readonly TrustFeature[] = [
  { key: "evidence-classes", label: "Evidence levels E0–E4", maturity: "IMPLEMENTED", requiresProfessionalReview: false, note: "Defined in domain and database; used by documents, evidence and jurisdiction records." },
  { key: "document-evidence-review", label: "Document evidence upload and review", maturity: "IMPLEMENTED", requiresProfessionalReview: false, note: "Storage, integrity hash, scan status and a human review state machine exist." },
  { key: "jurisdiction-source-registry", label: "Authoritative jurisdiction source, rule and obligation registry", maturity: "PREPARED", requiresProfessionalReview: true, note: "Domain types and in-force logic exist; there is no database table and seed records contain no sourced claims." },
  { key: "jurisdiction-lens", label: "Jurisdiction Lens comparison", maturity: "PARTIAL", requiresProfessionalReview: true, note: "Weighted indicator over workspace-recorded observations; unknown stays unknown. Not a legal ranking." },
  { key: "formation-roadmap", label: "Formation roadmap", maturity: "PARTIAL", requiresProfessionalReview: true, note: "Tasks can require professional review before completion; templates are not jurisdiction-verified." },
  { key: "compliance-tracking", label: "Compliance obligation tracking", maturity: "PARTIAL", requiresProfessionalReview: true, note: "Tracks workspace-entered obligations, evidence and reminders; statutory deadlines need authoritative data." },
  { key: "ai-explainability", label: "AI output explainability records", maturity: "PREPARED", requiresProfessionalReview: true, note: "Citation and review-gating logic is tested; no AI model is integrated and records are not persisted." },
  { key: "risk-simulation", label: "Risk simulation", maturity: "PLANNED", requiresProfessionalReview: true, note: "No underlying logic exists." },
  { key: "compliance-automation", label: "Automated compliance determination or filing", maturity: "PLANNED", requiresProfessionalReview: true, note: "Not implemented; only reminders and escalation of workspace-entered items exist." },
  { key: "professional-network", label: "Professional partner network and referral", maturity: "PLANNED", requiresProfessionalReview: false, note: "Escalation is currently to workspace advisers only." },
];

export function trustFeature(key: string): TrustFeature | undefined {
  return TRUST_FEATURES.find((feature) => feature.key === key);
}
