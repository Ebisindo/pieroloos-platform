import { describe, expect, it } from "vitest";
import { businessIntentProposalSchema } from "@/lib/validation/business-intent-proposal";

function validProposal() {
  return {
    businessSummary: "A founder plans to operate a consulting business across two jurisdictions.",
    assumptions: ["The founder will initially be the sole owner."],
    missingFacts: ["Expected annual revenue is not yet known."],
    complexity: {
      level: "UNDETERMINED",
      rationale: "The jurisdiction and tax facts are not yet verified.",
      factors: ["Cross-border operations", "Unknown revenue"],
    },
    jurisdictionComparisonCriteria: [
      { criterion: "Operating substance", rationale: "Confirm where management and services will occur." },
    ],
    proposedGraph: {
      nodes: [
        { id: "founder", label: "Founder", entityType: "PERSON", rationale: "Named as the intended owner by the user." },
        { id: "company", label: "Proposed company", entityType: "COMPANY", rationale: "Candidate entity, not yet formed." },
      ],
      edges: [
        { id: "ownership", fromNodeId: "founder", toNodeId: "company", relationshipType: "OWNS", ownershipPercentage: 100, rationale: "User-stated proposed ownership; subject to confirmation." },
      ],
    },
    riskScenarios: [
      { title: "Unverified tax residence", likelihood: "UNKNOWN", impact: "HIGH", rationale: "Residence and management facts are missing.", mitigations: ["Collect facts and obtain professional review."] },
    ],
    evidenceGaps: [
      { claimOrDecision: "Jurisdiction choice", missingEvidence: "Verified residence, operating location and current source material.", minimumEvidenceClass: "E3", professionalReviewRequired: true },
    ],
    evidenceReferences: [
      { referenceId: "user-intake-1", title: "Founder intake", sourceType: "USER_PROVIDED", supports: "Initial business intent only." },
    ],
    advisoryBrief: "This is a preliminary proposal, not a recommendation to incorporate or file.",
    reviewState: "PROPOSED",
  };
}

describe("business intent proposal contract", () => {
  it("accepts a complete proposal while keeping it in proposed state", () => {
    const parsed = businessIntentProposalSchema.parse(validProposal());
    expect(parsed.reviewState).toBe("PROPOSED");
    expect(parsed.complexity.level).toBe("UNDETERMINED");
    expect(parsed.evidenceGaps[0].professionalReviewRequired).toBe(true);
  });

  it("rejects unknown fields rather than accepting unsupported claims", () => {
    const proposal = { ...validProposal(), legalConclusion: "Guaranteed tax-free" };
    expect(businessIntentProposalSchema.safeParse(proposal).success).toBe(false);
  });

  it("rejects self-links and edges whose endpoints do not exist", () => {
    const proposal = validProposal();
    proposal.proposedGraph.edges = [
      { ...proposal.proposedGraph.edges[0], toNodeId: "founder" },
      { ...proposal.proposedGraph.edges[0], id: "missing-endpoint", toNodeId: "not-a-node" },
    ];
    const result = businessIntentProposalSchema.safeParse(proposal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("Self-links"))).toBe(true);
      expect(result.error.issues.some((issue) => issue.message.includes("Edge target"))).toBe(true);
    }
  });

  it("rejects duplicate node IDs and ownership percentages on non-ownership edges", () => {
    const proposal = validProposal();
    proposal.proposedGraph.nodes.push({ ...proposal.proposedGraph.nodes[0] });
    proposal.proposedGraph.edges[0] = {
      ...proposal.proposedGraph.edges[0],
      relationshipType: "DIRECTOR_OF",
      ownershipPercentage: 25,
    };
    const result = businessIntentProposalSchema.safeParse(proposal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("Node IDs must be unique"))).toBe(true);
      expect(result.error.issues.some((issue) => issue.message.includes("only valid for ownership"))).toBe(true);
    }
  });

  it("requires provenance metadata for retrieved sources", () => {
    const proposal = validProposal();
    proposal.evidenceReferences = [{
      referenceId: "retrieved-1",
      title: "Official source",
      sourceType: "RETRIEVED",
      supports: "A factual claim.",
    }];
    expect(businessIntentProposalSchema.safeParse(proposal).success).toBe(false);
  });

  it("rejects out-of-range ownership percentages", () => {
    const proposal = validProposal();
    proposal.proposedGraph.edges[0] = {
      ...proposal.proposedGraph.edges[0],
      ownershipPercentage: 150,
    };
    expect(businessIntentProposalSchema.safeParse(proposal).success).toBe(false);
  });
});
