import { describe, expect, it } from "vitest";
import {
  classifyInformationBasis,
  factorsRequireProfessionalReview,
  FEATURE_MATURITY_LEVELS,
  TRUST_FEATURES,
  weakestEvidenceClass,
  type TrustSourceReference,
} from "@/lib/domain/trust-boundary";
import { compareJurisdictions } from "@/lib/services/jurisdiction-engine";
import type { Jurisdiction, JurisdictionFactor } from "@/lib/domain/jurisdiction";

const asOf = new Date("2026-10-11T00:00:00Z");
const goodSource: TrustSourceReference = {
  reviewStatus: "VERIFIED",
  supersessionState: "ACTIVE",
  effectiveDate: new Date("2020-01-01"),
  retrievalDate: new Date("2026-03-01"),
};

describe("information basis classification", () => {
  it("treats E3+ evidence with a verified, in-force, retrieved source as source-supported", () => {
    const result = classifyInformationBasis({ evidenceClass: "E3", sources: [goodSource] }, asOf);
    expect(result.basis).toBe("SOURCE_SUPPORTED");
    expect(result.gaps).toEqual([]);
    expect(result.professionalReviewRequired).toBe(false);
  });

  it("never marks unsourced or E0 information as source-supported", () => {
    const result = classifyInformationBasis({ evidenceClass: "E0", sources: [] }, asOf);
    expect(result.basis).toBe("PLATFORM_GUIDANCE");
    expect(result.gaps).toEqual(expect.arrayContaining(["NO_EVIDENCE", "NO_SOURCE"]));
    expect(result.professionalReviewRequired).toBe(true);
  });

  it("does not let a verified source lift E1 or E2 evidence to source-supported", () => {
    for (const evidenceClass of ["E1", "E2"] as const) {
      const result = classifyInformationBasis({ evidenceClass, sources: [goodSource] }, asOf);
      expect(result.basis).toBe("PLATFORM_GUIDANCE");
      expect(result.gaps).toContain("EVIDENCE_BELOW_PRIMARY");
      expect(result.professionalReviewRequired).toBe(true);
    }
  });

  it.each<[string, TrustSourceReference, string]>([
    ["unverified", { ...goodSource, reviewStatus: "UNREVIEWED" }, "SOURCE_UNVERIFIED"],
    ["superseded", { ...goodSource, supersessionState: "SUPERSEDED" }, "SOURCE_NOT_IN_FORCE"],
    ["draft", { ...goodSource, supersessionState: "DRAFT" }, "SOURCE_NOT_IN_FORCE"],
    ["not yet effective", { ...goodSource, effectiveDate: new Date("2027-01-01") }, "SOURCE_NOT_IN_FORCE"],
    ["missing retrieval date", { ...goodSource, retrievalDate: null }, "MISSING_RETRIEVAL_DATE"],
  ])("falls back to platform guidance for a %s source", (_label, source, gap) => {
    const result = classifyInformationBasis({ evidenceClass: "E4", sources: [source] }, asOf);
    expect(result.basis).toBe("PLATFORM_GUIDANCE");
    expect(result.gaps).toContain(gap);
  });

  it("escalates high-risk topics even when well supported", () => {
    const result = classifyInformationBasis({ evidenceClass: "E4", sources: [goodSource], topics: ["TAX", "TAX"] }, asOf);
    expect(result.basis).toBe("SOURCE_SUPPORTED");
    expect(result.escalationTopics).toEqual(["TAX"]);
    expect(result.professionalReviewRequired).toBe(true);
  });
});

describe("evidence-driven review flag", () => {
  const factor = (evidenceClass: JurisdictionFactor["evidenceClass"], reviewRequired = false): JurisdictionFactor => ({
    criterionKey: "tax_clarity",
    value: 80,
    normalizedScore: 80,
    evidenceClass,
    sourceIds: [],
    confidence: 50,
    reviewRequired,
  });

  it("requires review for no factors, weak evidence or an explicit flag", () => {
    expect(factorsRequireProfessionalReview([])).toBe(true);
    expect(factorsRequireProfessionalReview([factor("E2")])).toBe(true);
    expect(factorsRequireProfessionalReview([factor("E4", true)])).toBe(true);
    expect(factorsRequireProfessionalReview([factor("E3"), factor("E4")])).toBe(false);
  });

  it("flags a comparison result when evidence is below primary even if reviewRequired is false", () => {
    const jurisdiction: Jurisdiction = { id: "j1", code: "NG", name: "Nigeria", factors: [factor("E1")] };
    const [result] = compareJurisdictions({
      jurisdictionIds: ["j1", "j1"],
      criteria: [{ key: "tax_clarity", name: "Tax clarity", description: "d", weight: 100 }],
      methodologyVersion: "1.0",
    } as never, [jurisdiction]);
    expect(result.analyticalIndicator).toBe(80);
    expect(result.professionalReviewRequired).toBe(true);
  });

  it("reports the weakest evidence class and defaults to E0", () => {
    expect(weakestEvidenceClass([])).toBe("E0");
    expect(weakestEvidenceClass(["E4", "E2", "E3"])).toBe("E2");
  });
});

describe("feature maturity registry", () => {
  it("uses unique keys and valid maturity levels", () => {
    const keys = TRUST_FEATURES.map((feature) => feature.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const feature of TRUST_FEATURES) expect(FEATURE_MATURITY_LEVELS).toContain(feature.maturity);
  });

  it("does not present unbuilt capabilities as working", () => {
    const byKey = Object.fromEntries(TRUST_FEATURES.map((feature) => [feature.key, feature.maturity]));
    expect(byKey["risk-simulation"]).toBe("PLANNED");
    expect(byKey["compliance-automation"]).toBe("PLANNED");
    expect(byKey["jurisdiction-source-registry"]).toBe("PREPARED");
    expect(byKey["ai-explainability"]).toBe("PREPARED");
  });
});
