import { z } from "zod";

export const notificationPreferenceSchema = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  quietHoursStart: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
  quietHoursEnd: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
  timezone: z.string().trim().min(1).max(100),
}).strict().superRefine((value, context) => {
  if ((value.quietHoursStart === null) !== (value.quietHoursEnd === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Quiet hours require both a start and end time.",
      path: ["quietHoursEnd"],
    });
  }
  if (value.quietHoursStart && value.quietHoursStart === value.quietHoursEnd) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Quiet hours must have different start and end times.",
      path: ["quietHoursEnd"],
    });
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.timezone });
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Timezone must be a valid IANA timezone.",
      path: ["timezone"],
    });
  }
});

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;
