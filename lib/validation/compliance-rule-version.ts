import { z } from "zod";

const applicabilitySchema = z.object({
  businessTypes: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  formationCompleted: z.boolean().optional(),
}).strict();

export const complianceRuleVersionSchema = z.object({
  ruleId: z.string().trim().min(1).max(120),
  version: z.number().int().positive(),
  jurisdictionId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(4000).nullable().optional(),
  type: z.enum([
    "FORMATION", "GOVERNANCE", "TAX", "IDENTIFICATION", "BANKING",
    "PAYMENT_INFRASTRUCTURE", "ANNUAL_FILING", "LICENSE", "REPORTING",
    "RENEWAL", "RECORDKEEPING", "OTHER",
  ]),
  sourceAuthority: z.string().trim().min(2).max(300),
  sourceUrl: z.string().url().max(2000),
  sourceRetrievedAt: z.coerce.date(),
  publicationDate: z.coerce.date().nullable().optional(),
  effectiveFrom: z.coerce.date(),
  effectiveThrough: z.coerce.date().nullable().optional(),
  evidenceClass: z.enum(["E0", "E1", "E2", "E3", "E4"]),
  applicability: applicabilitySchema,
  relativeDueDays: z.number().int().min(0).max(36500).nullable().optional(),
  requiresEvidence: z.boolean().default(false),
  professionalReviewRequired: z.literal(true).default(true),
  reviewState: z.enum(["UNREVIEWED", "VERIFIED", "REJECTED", "SUPERSEDED"]),
  reviewedByUserId: z.string().trim().min(1).max(120).nullable().optional(),
  reviewedAt: z.coerce.date().nullable().optional(),
}).strict().superRefine((rule, context) => {
  if (rule.effectiveThrough && rule.effectiveThrough < rule.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveThrough"],
      message: "Effective-through date must not precede effective-from date.",
    });
  }

  if (rule.sourceRetrievedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceRetrievedAt"],
      message: "Source retrieval timestamp cannot be in the future.",
    });
  }

  if (rule.reviewState === "VERIFIED") {
    if (!rule.reviewedByUserId?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewedByUserId"],
        message: "A verified rule must identify the reviewer.",
      });
    }
    if (!rule.reviewedAt || Number.isNaN(rule.reviewedAt.getTime())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewedAt"],
        message: "A verified rule must record the review timestamp.",
      });
    }
    if (rule.evidenceClass !== "E3" && rule.evidenceClass !== "E4") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceClass"],
        message: "A verified rule requires primary or cross-verified evidence.",
      });
    }
  }
});

export type ComplianceRuleVersionInput = z.infer<typeof complianceRuleVersionSchema>;
