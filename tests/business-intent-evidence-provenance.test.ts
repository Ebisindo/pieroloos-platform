import { describe, expect, it } from "vitest";
import { businessIntentInputSchema } from "@/lib/domain/business-intent-proposal";

const validInput = {
  businessName: "Example Logistics",
  businessObjective: "Provide reliable regional freight and logistics services.",
  homeJurisdiction: "Nigeria",
  knownFacts: [{
    statement: "The founder supplied this statement for review.",
  }],
};

describe("business-intent evidence intake provenance", () => {
  it("accepts a free-text statement only as an unverified claim", () => {
    const parsed = businessIntentInputSchema.safeParse(validInput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.knownFacts[0]?.statement).toBe(validInput.knownFacts[0].statement);
      expect(parsed.data.knownFacts[0]).not.toHaveProperty("evidenceClass");
      expect(parsed.data.knownFacts[0]).not.toHaveProperty("retrievedAt");
    }
  });

  it("accepts an evidence ID only as a lookup request, not as trusted provenance", () => {
    const parsed = businessIntentInputSchema.safeParse({
      ...validInput,
      knownFacts: [{ statement: "Check this source-backed claim.", evidenceId: "evidence-1" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.knownFacts[0]?.evidenceId).toBe("evidence-1");
  });

  it("rejects caller-supplied evidence class claims", () => {
    for (const evidenceClass of ["E0", "E1", "E2", "E3", "E4", "E3_PRIMARY", "E4_CROSS_VERIFIED"]) {
      expect(businessIntentInputSchema.safeParse({
        ...validInput,
        knownFacts: [{ statement: "Claim under review.", evidenceClass }],
      }).success).toBe(false);
    }
  });

  it("rejects caller-supplied retrieval timestamps", () => {
    expect(businessIntentInputSchema.safeParse({
      ...validInput,
      knownFacts: [{ statement: "Claim under review.", evidenceId: "evidence-1", retrievedAt: "2026-10-18T12:00:00.000Z" }],
    }).success).toBe(false);
  });

  it("rejects caller-supplied source URLs and verifier identity as authority", () => {
    for (const extra of [
      { sourceUrl: "https://example.com/source" },
      { verifiedBy: "administrator" },
      { reviewStatus: "VERIFIED" },
    ]) {
      expect(businessIntentInputSchema.safeParse({
        ...validInput,
        knownFacts: [{ statement: "Claim under review.", ...extra }],
      }).success).toBe(false);
    }
  });

  it("rejects legacy caller-defined fact IDs", () => {
    expect(businessIntentInputSchema.safeParse({
      ...validInput,
      knownFacts: [{ id: "fact-1", statement: "Claim under review." }],
    }).success).toBe(false);
  });
});
