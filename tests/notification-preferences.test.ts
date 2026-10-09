import { describe, expect, it } from "vitest";
import { notificationPreferenceSchema } from "@/lib/validation/notification-preferences";

const valid = {
  inAppEnabled: true,
  emailEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  timezone: "America/New_York",
};

describe("notification preference validation", () => {
  it("accepts valid cross-midnight quiet hours and IANA timezones", () => {
    expect(notificationPreferenceSchema.safeParse(valid).success).toBe(true);
  });

  it("requires both quiet-hour boundaries and rejects invalid timezone names", () => {
    expect(notificationPreferenceSchema.safeParse({
      ...valid,
      quietHoursEnd: null,
    }).success).toBe(false);
    expect(notificationPreferenceSchema.safeParse({
      ...valid,
      timezone: "Mars/Olympus",
    }).success).toBe(false);
  });

  it("rejects equal quiet-hour boundaries rather than interpreting them ambiguously", () => {
    expect(notificationPreferenceSchema.safeParse({
      ...valid,
      quietHoursStart: "22:00",
      quietHoursEnd: "22:00",
    }).success).toBe(false);
  });
});
