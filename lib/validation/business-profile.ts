import { z } from "zod";

export const businessProfileSchema = z.object({
  clientId: z.string().min(1),
  businessIdentity: z.string().trim().optional(),
  businessModel: z.string().trim().optional(),
  targetMarket: z.string().trim().optional(),
  revenueModel: z.string().trim().optional(),
  ownership: z.string().trim().optional(),
  expansionObjectives: z.array(z.string().trim()).default([]),
  fundingStage: z.string().trim().optional(),
  risksAndConstraints: z.array(z.string().trim()).default([]),
  strategicNotes: z.string().trim().optional(),
  operationalContext: z.string().trim().optional(),
});
