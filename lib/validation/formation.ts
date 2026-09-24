import { z } from "zod";

export const workingJurisdictionDecisionSchema = z.object({
  businessProfileId: z.string().min(1),
  comparisonSnapshotId: z.string().min(1),
  jurisdictionId: z.string().min(1),
  rationale: z.string().trim().max(5000).optional(),
  decidedByUserId: z.string().min(1),
  professionalReviewRequired: z.boolean().default(true),
  professionalReviewCompleted: z.boolean().default(false),
});

export const formationPlanCreateSchema = z.object({
  clientId: z.string().min(1),
  businessProfileId: z.string().min(1),
  comparisonSnapshotId: z.string().min(1),
  decisionId: z.string().min(1),
  jurisdictionId: z.string().min(1),
  jurisdictionName: z.string().trim().min(2).max(160),
  methodologyVersion: z.string().min(1).max(50),
});

export const formationTaskActionSchema = z.object({
  action: z.enum(["START", "COMPLETE", "WAIVE", "BLOCK", "REVIEW_APPROVE"]),
  note: z.string().trim().max(5000).optional(),
  evidenceIds: z.array(z.string()).default([]),
});
