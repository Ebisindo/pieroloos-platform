import { z } from "zod";

export const createObligationSchema = z.object({
  organizationId: z.string().min(1),
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
  dueAt: z.coerce.date().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  professionalReviewRequired: z.boolean().default(false),
});

export const updateComplianceStatusSchema = z.object({
  status: z.enum([
    "NOT_STARTED","IN_PROGRESS","AWAITING_EVIDENCE","IN_REVIEW",
    "COMPLIANT","OVERDUE","BLOCKED","WAIVED","NOT_APPLICABLE",
  ]),
  note: z.string().max(4000).optional(),
});

export const addComplianceEvidenceSchema = z.object({
  documentId: z.string().min(1),
  evidenceClass: z.enum(["E0","E1","E2","E3","E4"]),
  note: z.string().max(4000).optional(),
});

export const reminderSchema = z.object({
  scheduledFor: z.coerce.date(),
  channel: z.enum(["IN_APP","EMAIL"]),
  message: z.string().trim().min(2).max(2000),
});
