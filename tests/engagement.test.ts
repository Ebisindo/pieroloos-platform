import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "@/lib/domain/engagement";

describe("engagement workflow", () => {
  it("allows valid lifecycle transitions", () => {
    expect(canTransition("INTAKE", "ASSESSMENT")).toBe(true);
    expect(canTransition("EXECUTION", "VERIFICATION")).toBe(true);
  });

  it("rejects skipped stages", () => {
    expect(canTransition("INTAKE", "EXECUTION")).toBe(false);
    expect(() => assertTransition("INTAKE", "CLOSED")).toThrow();
  });

  it("protects closed engagements", () => {
    expect(canTransition("CLOSED", "INTAKE")).toBe(false);
  });
});
