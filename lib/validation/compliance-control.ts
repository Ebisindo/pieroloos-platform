import { z } from "zod";

export const controlCenterQuerySchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().optional(),
  status: z.enum([
    "NOT_STARTED","IN_PROGRESS","AWAITING_EVIDENCE","IN_REVIEW",
    "COMPLIANT","OVERDUE","BLOCKED","WAIVED","NOT_APPLICABLE",
  ]).optional(),
  days: z.coerce.number().int().min(0).max(365).default(30),
});

export const escalationPolicySchema = z.object({
  name: z.string().trim().min(2).max(120),
  enabled: z.boolean().default(true),
  overdueAfterDays: z.number().int().min(0).max(365).default(3),
  maxLevel: z.number().int().min(1).max(10).default(3),
  notifyChannels: z.array(z.enum(["IN_APP","EMAIL"])).min(1),
});
