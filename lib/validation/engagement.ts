import { z } from "zod";

export const engagementSchema = z.object({
  workspaceId: z.string().min(1),
  clientId: z.string().min(1),
  service: z.string().trim().min(2),
  nextAction: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
