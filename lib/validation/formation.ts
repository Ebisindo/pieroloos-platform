import { z } from "zod";

export const workingJurisdictionDecisionSchema = z.object({
  comparisonSnapshotId: z.string().min(1),
  jurisdictionId: z.string().min(1),
  rationale: z.string().trim().max(5000).optional(),
});

export const formationPlanCreateSchema = z.object({
  comparisonSnapshotId: z.string().min(1),
  jurisdictionId: z.string().min(1),
  rationale: z.string().trim().max(5000).optional(),
});

export const formationTaskActionSchema = z.object({
  action: z.enum(["START", "COMPLETE", "WAIVE", "BLOCK", "REVIEW_APPROVE", "SATISFY_EVIDENCE"]),
  note: z.string().trim().max(5000).optional(),
  evidenceRequirementKey: z.string().min(1).optional(),
  evidenceId: z.string().min(1).optional(),
});
