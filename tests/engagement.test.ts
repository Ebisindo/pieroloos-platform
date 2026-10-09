import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, getNextStatuses } from "@/lib/domain/engagement";

describe("engagement workflow", () => {
  it("allows valid lifecycle transitions", () => {
    expect(canTransition("INTAKE", "ASSESSMENT")).toBe(true);
    expect(canTransition("EXECUTION", "VERIFICATION")).toBe(true);
  });

  it("rejects skipped stages", () => {
    expect(canTransition("INTAKE", "EXECUTION")).toBe(false);
    expect(() => assertTransition("INTAKE", "COMPLETED")).toThrow();
  });

  it("protects completed engagements", () => {
    expect(canTransition("COMPLETED", "INTAKE")).toBe(false);
  });


  it("rejects unknown status values without crashing", () => {
    expect(canTransition("INTAKE" as never, "UNKNOWN" as never)).toBe(false);
    expect(getNextStatuses("UNKNOWN" as never)).toEqual([]);
    expect(() => assertTransition("UNKNOWN" as never, "INTAKE")).toThrow();
  });

});
