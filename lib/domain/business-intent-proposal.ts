import { z } from "zod";

const factSchema = z.object({
  id: z.string().trim().min(1).max(80),
  statement: z.string().trim().min(2).max(1600),
  sourceUrl: z.string().url().max(2000).optional(),
  evidenceClass: z.enum(["E0", "E1", "E2", "E3", "E4"]).default("E0"),
  retrievedAt: z.string().datetime().optional(),
}).strict();

export const businessIntentInputSchema = z.object({
  clientId: z.string().trim().min(1).max(100).optional(),
  businessName: z.string().trim().min(2).max(200),
  businessObjective: z.string().trim().min(10).max(4000),
  industry: z.string().trim().max(200).optional(),
  businessModel: z.string().trim().max(2000).optional(),
  homeJurisdiction: z.string().trim().min(2).max(200),
  targetMarkets: z.array(z.string().trim().min(2).max(100)).max(12).default([]),
  ownershipContext: z.string().trim().max(2000).optional(),
  revenueModel: z.string().trim().max(1000).optional(),
  capitalRange: z.string().trim().max(200).optional(),
  constraints: z.array(z.string().trim().min(2).max(800)).max(15).default([]),
  knownFacts: z.array(factSchema).max(20).default([]),
}).strict();

export const businessIntentProposalSchema = z.object({
  businessSummary: z.string().trim().min(10).max(2400),
  assumptions: z.array(z.string().trim().min(2).max(800)).max(20),
  missingFacts: z.array(z.string().trim().min(2).max(800)).max(20),
  complexity: z.enum(["LOW", "MODERATE", "HIGH", "UNCERTAIN"]),
  complexityRationale: z.string().trim().min(8).max(1600),
  jurisdictionComparisonCriteria: z.array(z.string().trim().min(2).max(600)).max(15),
  proposedEntities: z.array(z.object({
    key: z.string().regex(/^[a-z0-9_-]{1,50}$/),
    label: z.string().trim().min(2).max(200),
    category: z.enum(["PERSON", "LEGAL_ENTITY"]),
    jurisdictionSuggestion: z.string().trim().max(200).nullable(),
    purpose: z.string().trim().min(2).max(1000),
    rationale: z.string().trim().max(1200),
  }).strict()).min(1).max(20),
  proposedRelationships: z.array(z.object({
    fromKey: z.string().regex(/^[a-z0-9_-]{1,50}$/),
    toKey: z.string().regex(/^[a-z0-9_-]{1,50}$/),
    relationshipType: z.enum([
      "OWNS", "CONTROLS", "DIRECTOR_OF", "BENEFICIAL_OWNER",
      "CONTRACTUAL_RELATIONSHIP", "OTHER",
    ]),
    ownershipPercentage: z.number().min(0).max(100).nullable(),
    rationale: z.string().trim().min(2).max(1000),
  }).strict()).max(40),
  riskScenarios: z.array(z.object({
    title: z.string().trim().min(2).max(200),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "UNCERTAIN"]),
    scenario: z.string().trim().min(5).max(1200),
    assumptions: z.array(z.string().trim().min(2).max(400)).max(10),
    mitigations: z.array(z.string().trim().min(2).max(600)).max(10),
    needsProfessionalReview: z.boolean(),
  }).strict()).max(20),
  evidenceGaps: z.array(z.string().trim().min(2).max(800)).max(30),
  uncertaintyNotes: z.array(z.string().trim().min(2).max(800)).max(20),
  advisorBrief: z.string().trim().min(10).max(4000),
}).strict().superRefine((proposal, context) => {
  const keys = new Set<string>();
  proposal.proposedEntities.forEach((entity, index) => {
    if (keys.has(entity.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedEntities", index, "key"],
        message: "Entity keys must be unique.",
      });
    }
    keys.add(entity.key);
  });

  const relationships = new Set<string>();
  proposal.proposedRelationships.forEach((relationship, index) => {
    if (!keys.has(relationship.fromKey) || !keys.has(relationship.toKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedRelationships", index],
        message: "Relationships must reference proposed entities.",
      });
    }
    if (relationship.fromKey === relationship.toKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedRelationships", index],
        message: "Self-relationships are not allowed.",
      });
    }
    if (relationship.ownershipPercentage !== null &&
      !["OWNS", "BENEFICIAL_OWNER"].includes(relationship.relationshipType)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedRelationships", index, "ownershipPercentage"],
        message: "Ownership percentage is only valid for ownership relationships.",
      });
    }
    const relationshipKey = [
      relationship.fromKey,
      relationship.toKey,
      relationship.relationshipType,
    ].join(":");
    if (relationships.has(relationshipKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedRelationships", index],
        message: "Duplicate proposed relationships are not allowed.",
      });
    }
    relationships.add(relationshipKey);
  });
});

export type BusinessIntentInput = z.infer<typeof businessIntentInputSchema>;
export type BusinessIntentProposal = z.infer<typeof businessIntentProposalSchema>;
