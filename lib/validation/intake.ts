import { z } from "zod";

const optionalText = z.string().trim().max(5000).optional();

export const clientIntakeSchema = z.object({
  client: z.object({
    legalName: z.string().trim().min(2).max(200),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(50).optional(),
    residenceCountry: z.string().trim().max(100).optional(),
  }),
  business: z.object({
    proposedName: z.string().trim().max(200).optional(),
    businessType: z.string().trim().max(150).optional(),
    objective: z.string().trim().min(10).max(5000),
    targetMarket: optionalText,
    businessModel: optionalText,
    revenueModel: optionalText,
    fundingContext: optionalText,
    ownershipContext: optionalText,
    expansionObjectives: optionalText,
    constraints: optionalText,
    strategicNotes: optionalText,
    operationalContext: optionalText,
  }),
  engagement: z.object({
    service: z.string().trim().min(2).max(200),
    status: z.string().trim().max(80).optional(),
    nextAction: optionalText,
    notes: optionalText,
  }).optional(),
  intakeStatus: z.enum([
    "DRAFT",
    "SUBMITTED",
    "REVIEW_REQUIRED",
    "COMPLETED",
  ]).optional(),
});

export type ClientIntakeInput = z.infer<typeof clientIntakeSchema>;
