import { z } from "zod";

export const clientPortalGrantSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict();

export const clientPortalVisibilitySchema = z.object({
  resourceType: z.enum(["TASK", "FORMATION_TASK", "OBLIGATION"]),
  resourceId: z.string().trim().min(1).max(128),
  visible: z.boolean(),
}).strict();
