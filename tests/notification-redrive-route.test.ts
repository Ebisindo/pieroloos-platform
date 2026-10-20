import { afterEach, describe, expect, it, vi } from "vitest";

const { transactionMock, findFirstMock, updateManyMock, activityCreateMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  findFirstMock: vi.fn(),
  updateManyMock: vi.fn(),
  activityCreateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import { POST } from "@/app/api/workers/notifications/[id]/redrive/route";

const originalSecret = process.env.OPERATIONAL_WORKER_SECRET;
const transaction = {
  complianceNotification: {
    findFirst: findFirstMock,
    updateMany: updateManyMock,
  },
  activity: { create: activityCreateMock },
};

afterEach(() => {
  if (originalSecret === undefined) delete process.env.OPERATIONAL_WORKER_SECRET;
  else process.env.OPERATIONAL_WORKER_SECRET = originalSecret;
  findFirstMock.mockReset();
  updateManyMock.mockReset();
  activityCreateMock.mockReset();
  transactionMock.mockReset().mockImplementation((operation) => operation(transaction));
});

describe("notification dead-letter re-drive route", () => {
  it("requires the worker bearer secret", async () => {
    process.env.OPERATIONAL_WORKER_SECRET = "worker-secret";
    const response = await POST(new Request("http://localhost/api/workers/notifications/id/redrive", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    }), { params: Promise.resolve({ id: "notification-1" }) });

    expect(response.status).toBe(401);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("requeues only dead letters and writes an audit activity", async () => {
    process.env.OPERATIONAL_WORKER_SECRET = "worker-secret";
    findFirstMock.mockResolvedValue({
      id: "notification-1",
      workspaceId: "workspace-1",
      attemptCount: 5,
      maxAttempts: 5,
      failureReason: "Notification delivery failed (ETIMEDOUT).",
    });
    updateManyMock.mockResolvedValue({ count: 1 });

    const response = await POST(new Request("http://localhost/api/workers/notifications/id/redrive", {
      method: "POST",
      headers: { authorization: "Bearer worker-secret" },
    }), { params: Promise.resolve({ id: "notification-1" }) });

    expect(response.status).toBe(200);
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "notification-1", status: "DEAD_LETTER" },
      data: expect.objectContaining({
        status: "QUEUED",
        maxAttempts: { increment: 5 },
      }),
    }));
    expect(activityCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        title: "Dead-lettered notification requeued",
      }),
    }));
  });
});
