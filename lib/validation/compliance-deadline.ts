import { z } from "zod";

export const complianceDeadlineChangeSchema = z.object({
  dueAt: z.coerce.date().nullable(),
  reason: z.string().trim().min(8).max(2000),
  sourceRuleVersionId: z.string().trim().min(1).max(120).nullable().optional(),
  assessmentFacts: z.record(z.unknown()).default({}).refine(
    (facts) => Object.keys(facts).length <= 50,
    { message: "No more than 50 top-level assessment facts may be recorded." },
  ),
}).strict();

export type ComplianceDeadlineChangeInput = z.infer<typeof complianceDeadlineChangeSchema>;
