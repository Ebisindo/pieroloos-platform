import { z } from "zod";

export const clientIntakeSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  founderName: z.string().trim().min(2, "Founder/client name is required."),
  email: z.string().email().optional().or(z.literal("")),
  country: z.string().trim().optional(),
  proposedBusiness: z.string().trim().optional(),
  businessType: z.string().trim().optional(),
  businessObjective: z.string().trim().optional(),
  requestedService: z.string().trim().optional(),
  targetMarket: z.string().trim().optional(),
  businessModel: z.string().trim().optional(),
  fundingContext: z.string().trim().optional(),
  ownershipContext: z.string().trim().optional(),
  constraints: z.array(z.string().trim()).default([]),
  notes: z.string().trim().optional(),
});
export type ClientIntakeInput = z.infer<typeof clientIntakeSchema>;
