import { z } from "zod";

const nullableDateSchema = z.preprocess((value) => value === null ? null : value, z.coerce.date().nullable());

export const complianceDeadlineChangeSchema = z.object({
  dueAt: nullableDateSchema,
  reason: z.string().trim().min(8).max(2000),
  sourceRuleVersionId: z.string().trim().min(1).max(120).nullable().optional(),
  assessmentFacts: z.record(z.string(), z.unknown()).default({}).refine(
    (facts) => Object.keys(facts).length <= 50,
    { message: "No more than 50 top-level assessment facts may be recorded." },
  ),
}).strict();

export type ComplianceDeadlineChangeInput = z.infer<typeof complianceDeadlineChangeSchema>;
