import { z } from "zod";

export const businessProfileUpdateSchema = z.object({
  businessName: z.string().trim().max(200).optional(),
  businessModel: z.string().trim().max(5000).optional(),
  targetMarket: z.string().trim().max(5000).optional(),
  revenueModel: z.string().trim().max(5000).optional(),
  ownership: z.string().trim().max(5000).optional(),
  expansionObjectives: z.string().trim().max(5000).optional(),
  fundingStage: z.string().trim().max(5000).optional(),
  riskConstraints: z.string().trim().max(5000).optional(),
  strategicNotes: z.string().trim().max(5000).optional(),
  operationalContext: z.string().trim().max(5000).optional(),
});

export type BusinessProfileUpdateInput = z.infer<typeof businessProfileUpdateSchema>;
