import { describe, expect, it } from "vitest";
import { businessIntentProposalSchema } from "@/lib/domain/business-intent-proposal";

const base = {
  businessSummary: "A provisional cross-border operating structure.",
  assumptions: ["The business will operate in the target market."],
  missingFacts: ["Confirm corporate and licensing requirements."],
  complexity: "UNCERTAIN" as const,
  complexityRationale: "The source evidence and business facts are incomplete.",
  jurisdictionComparisonCriteria: ["Verified legal requirements and operating cost."],
  proposedEntities: [
    { key: "entity_a", label: "Potential Entity A", category: "LEGAL_ENTITY" as const, jurisdictionSuggestion: null, purpose: "Potential operating company.", rationale: "Requires professional review." },
    { key: "entity_b", label: "Potential Entity B", category: "LEGAL_ENTITY" as const, jurisdictionSuggestion: null, purpose: "Potential holding company.", rationale: "Requires professional review." },
    { key: "entity_c", label: "Potential Entity C", category: "LEGAL_ENTITY" as const, jurisdictionSuggestion: null, purpose: "Potential subsidiary.", rationale: "Requires professional review." },
  ],
  proposedRelationships: [] as Array<{
    fromKey: string; toKey: string;
    relationshipType: "OWNS" | "CONTROLS" | "DIRECTOR_OF" | "BENEFICIAL_OWNER" | "CONTRACTUAL_RELATIONSHIP" | "OTHER";
    ownershipPercentage: number | null; rationale: string;
  }>,
  riskScenarios: [],
  evidenceGaps: ["No primary source has been independently checked."],
  uncertaintyNotes: ["This is a planning proposal, not a legal conclusion."],
  advisorBrief: "Obtain verified source evidence and qualified review before taking any formation action.",
};

describe("business-intent production corporate-graph validation", () => {
  it("rejects ownership allocations exceeding 100 percent using the graph validator", () => {
    const result = businessIntentProposalSchema.safeParse({
      ...base,
      proposedRelationships: [
        { fromKey: "entity_a", toKey: "entity_c", relationshipType: "OWNS", ownershipPercentage: 60, rationale: "Provisional ownership." },
        { fromKey: "entity_b", toKey: "entity_c", relationshipType: "OWNS", ownershipPercentage: 50, rationale: "Provisional ownership." },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(issue => issue.message.includes("cannot total more than 100%"))).toBe(true);
  });

  it("rejects ownership cycles using the graph validator", () => {
    const result = businessIntentProposalSchema.safeParse({
      ...base,
      proposedRelationships: [
        { fromKey: "entity_a", toKey: "entity_b", relationshipType: "OWNS", ownershipPercentage: 60, rationale: "Provisional ownership." },
        { fromKey: "entity_b", toKey: "entity_a", relationshipType: "OWNS", ownershipPercentage: 40, rationale: "Provisional reverse ownership." },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(issue => issue.message.includes("must not create a cycle"))).toBe(true);
  });

  it("allows a graph-valid provisional proposal without creating operational graph records", () => {
    const result = businessIntentProposalSchema.safeParse({
      ...base,
      proposedRelationships: [
        { fromKey: "entity_a", toKey: "entity_b", relationshipType: "OWNS", ownershipPercentage: 100, rationale: "Provisional relationship only." },
      ],
    });
    expect(result.success).toBe(true);
  });
});
