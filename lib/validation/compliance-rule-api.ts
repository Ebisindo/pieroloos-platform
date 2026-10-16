import { z } from "zod";

const applicabilitySchema = z.object({
  businessTypes: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  formationCompleted: z.boolean().optional(),
}).strict();

const ruleContentShape = {
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(4000).nullable().optional(),
  type: z.enum([
    "FORMATION", "GOVERNANCE", "TAX", "IDENTIFICATION", "BANKING",
    "PAYMENT_INFRASTRUCTURE", "ANNUAL_FILING", "LICENSE", "REPORTING",
    "RENEWAL", "RECORDKEEPING", "OTHER",
  ]),
  sourceAuthority: z.string().trim().min(2).max(300),
  sourceUrl: z.string().url().max(2000).refine((value) => value.startsWith("https://"), {
    message: "Compliance rule sources must use HTTPS.",
  }),
  publicationDate: z.coerce.date().nullable().optional(),
  effectiveFrom: z.coerce.date(),
  effectiveThrough: z.coerce.date().nullable().optional(),
  applicability: applicabilitySchema,
  relativeDueDays: z.number().int().min(0).max(36500).nullable().optional(),
  requiresEvidence: z.boolean().default(false),
};

function validateRuleContent<T extends {
  effectiveFrom: Date;
  effectiveThrough?: Date | null;
  publicationDate?: Date | null;
}>(value: T, context: z.RefinementCtx) {
  if (value.effectiveThrough && value.effectiveThrough < value.effectiveFrom) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveThrough"],
      message: "Effective-through date must not precede effective-from date.",
    });
  }
  if (value.publicationDate && value.publicationDate.getTime() > Date.now() + 5 * 60 * 1000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicationDate"],
      message: "Publication date cannot be in the future.",
    });
  }
}

export const complianceRuleDraftSchema = z.object({
  ruleKey: z.string().trim().min(2).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
  jurisdictionId: z.string().trim().min(1).max(120),
  ...ruleContentShape,
}).strict().superRefine(validateRuleContent);

export const complianceRuleVersionDraftSchema = z.object({
  ...ruleContentShape,
}).strict().superRefine(validateRuleContent);

export const complianceRuleReviewSchema = z.object({
  decision: z.enum(["VERIFY", "REJECT"]),
  evidenceClass: z.enum(["E3", "E4"]).optional(),
  reviewNote: z.string().trim().min(8).max(2000),
}).strict().superRefine((value, context) => {
  if (value.decision === "VERIFY" && !value.evidenceClass) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidenceClass"],
      message: "Verification requires an explicit E3 or E4 evidence attestation.",
    });
  }
});

export type ComplianceRuleDraftInput = z.infer<typeof complianceRuleDraftSchema>;
export type ComplianceRuleVersionDraftInput = z.infer<typeof complianceRuleVersionDraftSchema>;
export type ComplianceRuleReviewInput = z.infer<typeof complianceRuleReviewSchema>;
