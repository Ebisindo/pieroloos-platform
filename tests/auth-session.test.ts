import { describe, expect, it } from "vitest";
import { AUTH_SESSION_MAX_AGE_SECONDS, authOptions } from "@/lib/auth/auth-options";

describe("authentication session policy", () => {
  it("uses a bounded eight-hour JWT session", () => {
    expect(AUTH_SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
    expect(authOptions.session).toEqual({ strategy: "jwt", maxAge: 8 * 60 * 60 });
  });
});
