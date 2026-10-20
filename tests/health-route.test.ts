import { afterEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: { $queryRaw: queryMock } }));

import { GET } from "@/app/api/health/route";

describe("health route", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reports ok when the database responds and returns a correlation ID", async () => {
    queryMock.mockResolvedValue([{ "?column?": 1 }]);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.headers.get("x-correlation-id")).toBe(body.correlationId);
  });

  it("reports degraded without leaking dependency errors", async () => {
    queryMock.mockRejectedValue(new Error("connect ECONNREFUSED secret-host"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await GET();
    const body = await response.json();
    const logOutput = String(error.mock.calls[0][0]);

    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain("secret-host");
    expect(logOutput).not.toContain("secret-host");
    expect(logOutput).not.toContain("ECONNREFUSED");
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.headers.get("x-correlation-id")).toBe(body.correlationId);
  });
});
