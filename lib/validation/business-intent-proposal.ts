import { z } from "zod";

const graphNodeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  entityType: z.enum(["PERSON", "COMPANY", "TRUST", "OTHER"]),
  rationale: z.string().trim().min(1).max(1000),
}).strict();

const graphEdgeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  fromNodeId: z.string().trim().min(1).max(80),
  toNodeId: z.string().trim().min(1).max(80),
  relationshipType: z.enum([
    "OWNS",
    "CONTROLS",
    "DIRECTOR_OF",
    "MEMBER_OF",
    "BENEFICIAL_OWNER_OF",
    "OTHER",
  ]),
  ownershipPercentage: z.number().min(0).max(100).optional(),
  rationale: z.string().trim().min(1).max(1000),
}).strict();

const evidenceReferenceSchema = z.object({
  referenceId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  sourceUrl: z.string().url().max(2000).optional(),
  sourceType: z.enum(["USER_PROVIDED", "RETRIEVED"]),
  retrievedAt: z.coerce.date().nullable().optional(),
  supports: z.string().trim().min(1).max(1000),
}).strict();

export const businessIntentProposalSchema = z.object({
  businessSummary: z.string().trim().min(1).max(3000),
  assumptions: z.array(z.string().trim().min(1).max(500)).max(30),
  missingFacts: z.array(z.string().trim().min(1).max(500)).max(30),
  complexity: z.object({
    level: z.enum(["LOW", "MODERATE", "HIGH", "UNDETERMINED"]),
    rationale: z.string().trim().min(1).max(2000),
    factors: z.array(z.string().trim().min(1).max(500)).max(20),
  }).strict(),
  jurisdictionComparisonCriteria: z.array(z.object({
    criterion: z.string().trim().min(1).max(160),
    rationale: z.string().trim().min(1).max(800),
  }).strict()).max(20),
  proposedGraph: z.object({
    nodes: z.array(graphNodeSchema).max(100),
    edges: z.array(graphEdgeSchema).max(200),
  }).strict(),
  riskScenarios: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    likelihood: z.enum(["LOW", "MODERATE", "HIGH", "UNKNOWN"]),
    impact: z.enum(["LOW", "MODERATE", "HIGH", "UNKNOWN"]),
    rationale: z.string().trim().min(1).max(1500),
    mitigations: z.array(z.string().trim().min(1).max(500)).max(20),
  }).strict()).max(30),
  evidenceGaps: z.array(z.object({
    claimOrDecision: z.string().trim().min(1).max(500),
    missingEvidence: z.string().trim().min(1).max(1000),
    minimumEvidenceClass: z.enum(["E0", "E1", "E2", "E3", "E4"]),
    professionalReviewRequired: z.boolean().default(true),
  }).strict()).max(50),
  evidenceReferences: z.array(evidenceReferenceSchema).max(100),
  advisoryBrief: z.string().trim().min(1).max(5000),
  reviewState: z.literal("PROPOSED").default("PROPOSED"),
}).strict().superRefine((proposal, context) => {
  const nodeIds = new Set<string>();
  proposal.proposedGraph.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedGraph", "nodes", index, "id"],
        message: "Node IDs must be unique.",
      });
    }
    nodeIds.add(node.id);
  });

  const edgeIds = new Set<string>();
  proposal.proposedGraph.edges.forEach((edge, index) => {
    if (edgeIds.has(edge.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedGraph", "edges", index, "id"],
        message: "Edge IDs must be unique.",
      });
    }
    edgeIds.add(edge.id);

    if (edge.fromNodeId === edge.toNodeId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedGraph", "edges", index, "toNodeId"],
        message: "Self-links are not allowed in a proposed corporate graph.",
      });
    }
    if (!nodeIds.has(edge.fromNodeId) || !proposal.proposedGraph.nodes.some((node) => node.id === edge.fromNodeId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedGraph", "edges", index, "fromNodeId"],
        message: "Edge source must reference a proposed node.",
      });
    }
    if (!proposal.proposedGraph.nodes.some((node) => node.id === edge.toNodeId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedGraph", "edges", index, "toNodeId"],
        message: "Edge target must reference a proposed node.",
      });
    }
    if (edge.ownershipPercentage !== undefined &&
      edge.relationshipType !== "OWNS" &&
      edge.relationshipType !== "BENEFICIAL_OWNER_OF") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedGraph", "edges", index, "ownershipPercentage"],
        message: "Ownership percentages are only valid for ownership relationships.",
      });
    }
  });

  const referenceIds = new Set<string>();
  proposal.evidenceReferences.forEach((reference, index) => {
    if (referenceIds.has(reference.referenceId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceReferences", index, "referenceId"],
        message: "Evidence reference IDs must be unique.",
      });
    }
    referenceIds.add(reference.referenceId);
    if (reference.sourceType === "RETRIEVED" && (!reference.sourceUrl || !reference.retrievedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceReferences", index],
        message: "Retrieved sources require a URL and retrieval timestamp.",
      });
    }
  });
});

export type BusinessIntentProposal = z.infer<typeof businessIntentProposalSchema>;
