import { z } from "zod";
import { ACTIVITY_TYPES, ENGAGEMENT_STATUSES } from "@/lib/domain/engagement";

export const engagementCreateSchema = z.object({
  clientId: z.string().min(1),
  service: z.string().trim().min(2).max(200),
  ownerId: z.string().trim().max(100).optional(),
  nextAction: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export const engagementUpdateSchema = z.object({
  service: z.string().trim().min(2).max(200).optional(),
  ownerId: z.string().trim().max(100).nullable().optional(),
  nextAction: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export const engagementTransitionSchema = z.object({
  toStatus: z.enum(ENGAGEMENT_STATUSES),
  note: z.string().trim().max(2000).optional(),
});

export const activityCreateSchema = z.object({
  engagementId: z.string().min(1),
  type: z.enum(ACTIVITY_TYPES),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  actorId: z.string().trim().max(100).optional(),
});

export type EngagementCreateInput = z.infer<typeof engagementCreateSchema>;
export type EngagementUpdateInput = z.infer<typeof engagementUpdateSchema>;
export type EngagementTransitionInput = z.infer<typeof engagementTransitionSchema>;
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
