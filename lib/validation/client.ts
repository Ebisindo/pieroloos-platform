import { z } from 'zod';

export const clientIntakeSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, 'Client name is required'),
  email: z.string().email().optional().or(z.literal('')),
  country: z.string().trim().optional(),
  proposedBusiness: z.string().trim().optional(),
  intakeData: z.record(z.string(), z.unknown()).optional(),
});

export type ClientIntakeInput = z.infer<typeof clientIntakeSchema>;
