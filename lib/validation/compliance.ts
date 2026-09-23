import { z } from "zod";

export const complianceItemSchema = z.object({
  engagementId: z.string().optional(),
  category: z.string().trim().min(1),
  title: z.string().trim().min(1),
  jurisdiction: z.string().trim().optional(),
  dueAt: z.coerce.date().optional(),
});
