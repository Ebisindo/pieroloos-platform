import { z } from "zod";

export const workspaceSettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(80).refine((timezone) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }, "Select a supported time zone."),
  defaultLandingPage: z.enum([
    "/command-center",
    "/clients",
    "/jurisdictions",
    "/formation",
    "/compliance",
  ]),
  complianceReminderDays: z.number().int().min(1).max(365),
  notificationsEnabled: z.boolean(),
  complianceDueNotifications: z.boolean(),
  evidenceReviewNotifications: z.boolean(),
}).strict();

export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettingsInput = {
  timezone: "UTC",
  defaultLandingPage: "/command-center",
  complianceReminderDays: 30,
  notificationsEnabled: true,
  complianceDueNotifications: true,
  evidenceReviewNotifications: true,
};