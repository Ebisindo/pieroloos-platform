import { z } from "zod";

export const clientPortalGrantSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict();

export const clientPortalGrantUpdateSchema = z.object({
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  canViewStatus: z.boolean(),
  canViewTasks: z.boolean(),
  canUploadEvidence: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.expiresAt !== null && new Date(value.expiresAt).getTime() <= Date.now()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expiresAt"],
      message: "Grant expiry must be in the future or null.",
    });
  }
});

export const clientPortalVisibilitySchema = z.object({
  resourceType: z.enum(["TASK", "FORMATION_TASK", "OBLIGATION"]),
  resourceId: z.string().trim().min(1).max(128),
  visible: z.boolean(),
}).strict();
