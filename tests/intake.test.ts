import { describe, expect, it } from "vitest";
import { clientIntakeSchema } from "@/lib/validation/intake";

describe("client intake", () => {
  it("accepts the minimum viable intake", () => {
    const result = clientIntakeSchema.safeParse({
      client: { legalName: "Example Founder" },
      business: { objective: "Establish and operate an international business." },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty business objective", () => {
    const result = clientIntakeSchema.safeParse({
      client: { legalName: "Example Founder" },
      business: { objective: "" },
    });

    expect(result.success).toBe(false);
  });
});
