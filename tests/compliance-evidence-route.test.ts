import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/compliance/evidence/route";

describe("compliance evidence portfolio endpoint", () => {
  it("fails closed instead of returning unauthenticated fixture evidence", async () => {
    const response = await GET();
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      error: "Compliance evidence portfolio is not configured.",
    });
  });
});
