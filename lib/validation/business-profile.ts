import { z } from "zod";

const profileText = z.string().trim().max(5000).optional();

export const businessProfileUpdateSchema = z.object({
  businessName: z.string().trim().max(200).optional(),
  businessType: z.string().trim().max(150).optional(),
  objective: profileText,
  businessModel: profileText,
  targetMarket: profileText,
  revenueModel: profileText,
  ownership: profileText,
  expansionObjectives: profileText,
  fundingStage: profileText,
  riskConstraints: profileText,
  strategicNotes: profileText,
  operationalContext: profileText,
}).strict().refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one business profile field must be provided.",
});

export type BusinessProfileUpdateInput = z.infer<typeof businessProfileUpdateSchema>;
