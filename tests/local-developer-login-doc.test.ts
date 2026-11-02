import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("local developer login documentation", () => {
  it("documents local-only configuration with safe placeholders", () => {
    const content = readFileSync("docs/LOCAL-DEVELOPER-LOGIN.md", "utf8");
    expect(content).toContain('LOCAL_AUTH_ENABLED="true"');
    expect(content).toContain('LOCAL_AUTH_EMAIL="pierolocorpinternational@gmail.com"');
    expect(content).toContain('LOCAL_AUTH_PASSWORD="SET_THE_DEVELOPMENT_PASSWORD_LOCALLY"');
    expect(content).toContain("does not create an account");
    expect(content).toContain("existing user with an organization membership");
    expect(content).toContain("never a production fallback");
    expect(content).not.toMatch(/LOCAL_AUTH_PASSWORD="(?!SET_THE_DEVELOPMENT_PASSWORD_LOCALLY)[^"]+"/);
  });
});
