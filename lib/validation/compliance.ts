import { z } from "zod";

const nullableDateSchema = z.preprocess((value) => value === null ? null : value, z.coerce.date().nullable());

export const createObligationSchema = z.object({
  clientId: z.string().min(1),
  businessProfileId: z.string().optional().nullable(),
  formationPlanId: z.string().optional().nullable(),
  jurisdictionId: z.string().optional().nullable(),
  title: z.string().trim().min(2).max(240),
  description: z.string().max(4000).optional().nullable(),
  type: z.enum([
    "FORMATION","GOVERNANCE","TAX","IDENTIFICATION","BANKING",
    "PAYMENT_INFRASTRUCTURE","ANNUAL_FILING","LICENSE","REPORTING",
    "RENEWAL","RECORDKEEPING","OTHER",
  ]),
  dueAt: nullableDateSchema.optional(),
  requiresEvidence: z.boolean().default(false),
  professionalReviewRequired: z.boolean().default(false),
});

export const updateComplianceStatusSchema = z.object({
  status: z.enum([
    "NOT_STARTED","IN_PROGRESS","AWAITING_EVIDENCE","IN_REVIEW",
    "COMPLIANT","OVERDUE","BLOCKED","WAIVED","NOT_APPLICABLE",
  ]),
  expectedStatus: z.enum([
    "NOT_STARTED","IN_PROGRESS","AWAITING_EVIDENCE","IN_REVIEW","COMPLETE","COMPLETED",
    "COMPLIANT","OVERDUE","BLOCKED","WAIVED","NOT_APPLICABLE",
  ]).optional(),
  note: z.string().max(4000).optional(),
}).strict();

export const approveComplianceReviewSchema = z.object({
  note: z.string().trim().max(4000).optional(),
});

export const addComplianceEvidenceSchema = z.object({
  documentId: z.string().min(1),
  evidenceClass: z.enum(["E0","E1","E2","E3","E4"]),
  factKey: z.enum(["BUSINESS_TYPE", "FORMATION_COMPLETED", "TRIGGER_DATE"]).optional(),
  factValue: z.string().trim().min(1).max(500).optional(),
  note: z.string().max(4000).optional(),
  sourceReference: z.string().trim().max(2000).optional(),
  validThrough: nullableDateSchema.optional(),
}).strict().superRefine((value, context) => {
  if ((value.factKey && !value.factValue) || (!value.factKey && value.factValue)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["factValue"], message: "Structured fact assertions require both factKey and factValue." });
  }
});

export const reviewComplianceEvidenceSchema = z.object({
  reviewStatus: z.enum(["VERIFIED", "CHANGES_REQUESTED", "REVOKED"]),
  note: z.string().trim().min(4).max(4000),
});

export const assignComplianceObligationSchema = z.object({
  ownerUserId: z.string().min(1).nullable(),
});

export const reminderSchema = z.object({
  scheduledFor: z.coerce.date(),
  channel: z.enum(["IN_APP","EMAIL"]),
  message: z.string().trim().min(2).max(2000),
});
