import { describe, expect, it } from "vitest";
import {
  complianceRuleDraftSchema,
  complianceRuleReviewSchema,
  complianceRuleVersionDraftSchema,
} from "@/lib/validation/compliance-rule-api";

function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    ruleKey: "annual-report",
    jurisdictionId: "jurisdiction-1",
    title: "Annual reporting rule",
    description: "A source-backed rule draft awaiting review.",
    type: "ANNUAL_FILING",
    sourceAuthority: "Official registry",
    sourceUrl: "https://example.gov/rules/annual-report",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveThrough: null,
    applicability: { businessTypes: ["COMPANY"] },
    relativeDueDays: null,
    requiresEvidence: true,
    ...overrides,
  };
}

describe("compliance rule authoring contracts", () => {
  it("accepts a strict draft but never accepts client-supplied review state or retrieval timestamp", () => {
    expect(complianceRuleDraftSchema.safeParse(validDraft()).success).toBe(true);
    expect(complianceRuleDraftSchema.safeParse(validDraft({
      reviewState: "VERIFIED",
      evidenceClass: "E4",
      sourceRetrievedAt: "2026-10-16T00:00:00.000Z",
    })).success).toBe(false);
  });

  it("requires HTTPS source URLs and sensible effective-date ranges", () => {
    expect(complianceRuleDraftSchema.safeParse(validDraft({
      sourceUrl: "http://example.gov/rules/annual-report",
    })).success).toBe(false);
    expect(complianceRuleDraftSchema.safeParse(validDraft({
      effectiveFrom: "2026-11-01T00:00:00.000Z",
      effectiveThrough: "2026-10-01T00:00:00.000Z",
    })).success).toBe(false);
  });


  it("preserves unknown null dates instead of coercing them to the Unix epoch", () => {
    const draft = complianceRuleDraftSchema.parse(validDraft({ publicationDate: null, effectiveThrough: null }));
    expect(draft.publicationDate).toBeNull();
    expect(draft.effectiveThrough).toBeNull();
  });

  it("creates version drafts without parent identifiers or review metadata", () => {
    const { ruleKey: _ruleKey, jurisdictionId: _jurisdictionId, ...version } = validDraft();
    expect(complianceRuleVersionDraftSchema.safeParse(version).success).toBe(true);
    expect(complianceRuleVersionDraftSchema.safeParse({
      ...version,
      version: 9,
      reviewState: "VERIFIED",
    }).success).toBe(false);
  });

  it("requires an explicit source-opened attestation and E3/E4 for verification", () => {
    expect(complianceRuleReviewSchema.safeParse({
      decision: "VERIFY",
      evidenceClass: "E3",
      reviewNote: "Checked the official source.",
    }).success).toBe(false);
    expect(complianceRuleReviewSchema.safeParse({
      decision: "VERIFY",
      evidenceClass: "E3",
      sourceOpenedAndChecked: true,
      reviewNote: "Checked the official source.",
    }).success).toBe(true);
    expect(complianceRuleReviewSchema.safeParse({
      decision: "VERIFY",
      evidenceClass: "E2",
      sourceOpenedAndChecked: true,
      reviewNote: "Checked the official source.",
    }).success).toBe(false);
  });

  it("permits a recorded rejection without pretending the source was verified", () => {
    expect(complianceRuleReviewSchema.safeParse({
      decision: "REJECT",
      reviewNote: "Source does not support the asserted requirement.",
    }).success).toBe(true);
  });
});
