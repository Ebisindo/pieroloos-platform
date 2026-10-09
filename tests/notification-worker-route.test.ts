import { afterEach, describe, expect, it, vi } from "vitest";

const runWorkerMock = vi.hoisted(() => vi.fn());
const originalSecret = process.env.OPERATIONAL_WORKER_SECRET;

vi.mock("@/lib/services/notification-worker", () => ({
  runNotificationWorker: runWorkerMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    complianceNotification: {
      groupBy: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/workers/notifications/route";

afterEach(() => {
  if (originalSecret === undefined) delete process.env.OPERATIONAL_WORKER_SECRET;
  else process.env.OPERATIONAL_WORKER_SECRET = originalSecret;
  runWorkerMock.mockReset();
});

describe("notification worker route", () => {
  it("requires worker secret configuration and constant-time bearer authentication", async () => {
    delete process.env.OPERATIONAL_WORKER_SECRET;
    expect((await POST(new Request("http://localhost/api/workers/notifications", { method: "POST" }))).status).toBe(503);

    process.env.OPERATIONAL_WORKER_SECRET = "scheduler-secret";
    expect((await POST(new Request("http://localhost/api/workers/notifications", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    }))).status).toBe(401);
    expect(runWorkerMock).not.toHaveBeenCalled();
  });

  it("validates bounded batch size before running the worker", async () => {
    process.env.OPERATIONAL_WORKER_SECRET = "scheduler-secret";
    const response = await POST(new Request("http://localhost/api/workers/notifications?limit=101", {
      method: "POST",
      headers: { authorization: "Bearer scheduler-secret" },
    }));

    expect(response.status).toBe(400);
    expect(runWorkerMock).not.toHaveBeenCalled();
  });

  it("runs an authenticated bounded batch", async () => {
    process.env.OPERATIONAL_WORKER_SECRET = "scheduler-secret";
    runWorkerMock.mockResolvedValue({ claimed: 2, delivered: 2 });
    const response = await POST(new Request("http://localhost/api/workers/notifications?limit=5", {
      method: "POST",
      headers: { authorization: "Bearer scheduler-secret" },
    }));

    expect(response.status).toBe(200);
    expect(runWorkerMock).toHaveBeenCalledWith(expect.any(Date), 5);
  });
});
