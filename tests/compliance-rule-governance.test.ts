import { describe, expect, it } from "vitest";
import { assessComplianceRuleReadiness } from "@/lib/domain/compliance-rule-governance";
import { complianceRuleVersionSchema } from "@/lib/validation/compliance-rule-version";

const now = new Date("2026-10-16T12:00:00.000Z");

function rule(overrides: Record<string, unknown> = {}) {
  return {
    ruleId: "rule-annual-report",
    version: 1,
    jurisdictionId: "jurisdiction-1",
    title: "Annual reporting rule",
    type: "ANNUAL_FILING",
    sourceAuthority: "Official registry",
    sourceUrl: "https://example.gov/rules/annual-reporting",
    sourceRetrievedAt: new Date("2026-10-01T00:00:00.000Z"),
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveThrough: null,
    evidenceClass: "E3",
    applicability: { businessTypes: ["COMPANY"], formationCompleted: true },
    relativeDueDays: null,
    requiresEvidence: true,
    professionalReviewRequired: true,
    reviewState: "VERIFIED",
    reviewedByUserId: "reviewer-1",
    reviewedAt: new Date("2026-10-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("sourced compliance rule version contract", () => {
  it("requires authority, URL, retrieval timestamp, version and primary/cross-verified review to mark verified", () => {
    expect(complianceRuleVersionSchema.safeParse(rule()).success).toBe(true);
    expect(complianceRuleVersionSchema.safeParse(rule({ reviewedByUserId: null })).success).toBe(false);
    expect(complianceRuleVersionSchema.safeParse(rule({ evidenceClass: "E2" })).success).toBe(false);
    expect(complianceRuleVersionSchema.safeParse(rule({ sourceUrl: "not-a-url" })).success).toBe(false);
  });

  it("rejects an invalid effective date range and future retrieval timestamp", () => {
    expect(complianceRuleVersionSchema.safeParse(rule({
      effectiveThrough: new Date("2025-12-31T00:00:00.000Z"),
    })).success).toBe(false);
    expect(complianceRuleVersionSchema.safeParse(rule({
      sourceRetrievedAt: new Date("2035-01-01T00:00:00.000Z"),
    })).success).toBe(false);
  });

  it("returns unknown and blocks generation for unreviewed, rejected or superseded sources", () => {
    for (const reviewState of ["UNREVIEWED", "REJECTED", "SUPERSEDED"]) {
      const result = assessComplianceRuleReadiness(rule({ reviewState, reviewedByUserId: null, reviewedAt: null, evidenceClass: "E2" }), {
        jurisdictionId: "jurisdiction-1",
        businessType: "COMPANY",
        formationCompleted: true,
        evaluatedAt: now,
      });
      expect(result.state).toBe("UNKNOWN");
      expect(result.mayGenerateObligation).toBe(false);
    }
  });

  it("keeps missing facts unknown instead of treating them as not applicable", () => {
    const result = assessComplianceRuleReadiness(rule(), {
      jurisdictionId: "jurisdiction-1",
      businessType: null,
      formationCompleted: true,
      evaluatedAt: now,
    });
    expect(result).toMatchObject({ state: "UNKNOWN", reasons: ["MISSING_BUSINESS_TYPE"], mayGenerateObligation: false });
  });

  it("returns not applicable only for a verified rule with a known fact mismatch", () => {
    const result = assessComplianceRuleReadiness(rule(), {
      jurisdictionId: "jurisdiction-1",
      businessType: "SOLE_PROPRIETOR",
      formationCompleted: true,
      evaluatedAt: now,
    });
    expect(result).toMatchObject({ state: "NOT_APPLICABLE", reasons: ["BUSINESS_TYPE_MISMATCH"], mayGenerateObligation: false });
  });

  it("never enables obligation creation directly, even after a readiness result", () => {
    const result = assessComplianceRuleReadiness(rule(), {
      jurisdictionId: "jurisdiction-1",
      businessType: "COMPANY",
      formationCompleted: true,
      evaluatedAt: now,
    });
    expect(result).toMatchObject({ state: "APPLICABLE", mayGenerateObligation: false, ruleVersion: 1 });
  });
});
