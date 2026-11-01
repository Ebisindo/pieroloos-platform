import { z } from "zod";
import { ACTIVITY_TYPES, ENGAGEMENT_STATUSES } from "@/lib/domain/engagement";

export const engagementCreateSchema = z.object({
  clientId: z.string().trim().min(1).max(100),
  service: z.string().trim().min(2).max(200),
  nextAction: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(5000).optional(),
}).strict();

export const engagementUpdateSchema = z.object({
  service: z.string().trim().min(2).max(200).optional(),
  nextAction: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
}).strict().refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one engagement field must be provided.",
});

export const engagementTransitionSchema = z.object({
  toStatus: z.enum(ENGAGEMENT_STATUSES),
  note: z.string().trim().max(2000).optional(),
}).strict();

export const activityCreateSchema = z.object({
  engagementId: z.string().min(1).optional(),
  workspaceId: z.string().trim().min(1).optional(),
  type: z.enum(ACTIVITY_TYPES),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  actorId: z.string().trim().max(100).optional(),
}).strict();

export type EngagementCreateInput = z.infer<typeof engagementCreateSchema>;
export type EngagementUpdateInput = z.infer<typeof engagementUpdateSchema>;
export type EngagementTransitionInput = z.infer<typeof engagementTransitionSchema>;
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
