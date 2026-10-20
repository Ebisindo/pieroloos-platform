import { describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: { $queryRaw: queryMock } }));

import { GET } from "@/app/api/health/route";

describe("health route", () => {
  it("reports ok when the database responds", async () => {
    queryMock.mockResolvedValue([{ "?column?": 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("reports degraded without leaking the error", async () => {
    queryMock.mockRejectedValue(new Error("connect ECONNREFUSED secret-host"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret-host");
  });
});
