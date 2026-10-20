import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  workspaceSettingsSchema,
} from "@/lib/validation/settings";

describe("workspace settings", () => {
  it("accepts defaults with a supported IANA time zone", () => {
    expect(workspaceSettingsSchema.safeParse(DEFAULT_WORKSPACE_SETTINGS).success).toBe(true);
  });

  it("rejects unsupported time zones and landing destinations", () => {
    expect(workspaceSettingsSchema.safeParse({
      ...DEFAULT_WORKSPACE_SETTINGS,
      timezone: "Not/A_Time_Zone",
    }).success).toBe(false);
    expect(workspaceSettingsSchema.safeParse({
      ...DEFAULT_WORKSPACE_SETTINGS,
      defaultLandingPage: "https://example.com",
    }).success).toBe(false);
  });
});
