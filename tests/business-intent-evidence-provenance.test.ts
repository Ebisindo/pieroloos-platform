import { describe, expect, it } from "vitest";
import { businessIntentInputSchema } from "@/lib/domain/business-intent-proposal";

const validInput = {
  businessName: "Example Logistics",
  businessObjective: "Provide reliable regional freight and logistics services.",
  homeJurisdiction: "Nigeria",
  knownFacts: [{
    id: "fact-1",
    statement: "The founder supplied this statement for review.",
    sourceUrl: "https://example.com/about",
    evidenceClass: "E1",
  }],
};

describe("business-intent evidence intake provenance", () => {
  it("accepts user-provided source references only as E1 claims", () => {
    const parsed = businessIntentInputSchema.safeParse(validInput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.knownFacts[0]?.evidenceClass).toBe("E1");
      expect(parsed.data.knownFacts[0]).not.toHaveProperty("retrievedAt");
    }
  });

  it("does not allow callers to self-assert primary, secondary or cross-verified evidence", () => {
    for (const evidenceClass of ["E2", "E3", "E4"]) {
      expect(businessIntentInputSchema.safeParse({
        ...validInput,
        knownFacts: [{ ...validInput.knownFacts[0], evidenceClass }],
      }).success).toBe(false);
    }
  });

  it("does not accept caller-supplied retrieval timestamps as provenance", () => {
    expect(businessIntentInputSchema.safeParse({
      ...validInput,
      knownFacts: [{
        ...validInput.knownFacts[0],
        retrievedAt: "2026-10-18T12:00:00.000Z",
      }],
    }).success).toBe(false);
  });

  it("rejects non-HTTPS source URLs", () => {
    expect(businessIntentInputSchema.safeParse({
      ...validInput,
      knownFacts: [{ ...validInput.knownFacts[0], sourceUrl: "http://example.com/source" }],
    }).success).toBe(false);
  });

  it("rejects source URLs containing embedded credentials", () => {
    expect(businessIntentInputSchema.safeParse({
      ...validInput,
      knownFacts: [{ ...validInput.knownFacts[0], sourceUrl: "https://user:secret@example.com/source" }],
    }).success).toBe(false);
  });

  it("rejects unknown provenance fields because the intake schema is strict", () => {
    expect(businessIntentInputSchema.safeParse({
      ...validInput,
      knownFacts: [{ ...validInput.knownFacts[0], verifiedBy: "administrator" }],
    }).success).toBe(false);
  });
});
