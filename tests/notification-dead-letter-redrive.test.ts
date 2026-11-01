import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  transactionMock, notificationFindFirstMock, notificationUpdateManyMock, activityCreateMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  notificationFindFirstMock: vi.fn(),
  notificationUpdateManyMock: vi.fn(),
  activityCreateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));

import { POST } from "@/app/api/workers/notifications/[id]/redrive/route";

const originalSecret = process.env.OPERATIONAL_WORKER_SECRET;
const routeContext = { params: Promise.resolve({ id: "notification-1" }) };

function request(secret = "operator-secret") {
  return new Request("http://localhost/api/workers/notifications/notification-1/redrive", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("dead-letter recovery operation", () => {
  beforeEach(() => {
    process.env.OPERATIONAL_WORKER_SECRET = "operator-secret";
    notificationFindFirstMock.mockReset().mockResolvedValue({
      id: "notification-1",
      workspaceId: "workspace-1",
      attemptCount: 5,
      maxAttempts: 5,
      failureReason: "Notification delivery failed (EAUTH).",
    });
    notificationUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    transactionMock.mockReset().mockImplementation(async (callback) => callback({
      complianceNotification: { findFirst: notificationFindFirstMock, updateMany: notificationUpdateManyMock },
      activity: { create: activityCreateMock },
    }));
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.OPERATIONAL_WORKER_SECRET;
    else process.env.OPERATIONAL_WORKER_SECRET = originalSecret;
  });

  it("rejects unauthenticated redrive requests", async () => {
    const response = await POST(request("wrong-secret"), routeContext);
    expect(response.status).toBe(401);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("only requeues dead-lettered records and writes the operator audit event atomically", async () => {
    const response = await POST(request(), routeContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { id: "notification-1", status: "REQUEUED" } });
    expect(notificationFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "notification-1", status: "DEAD_LETTER" },
    }));
    expect(notificationUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "notification-1", status: "DEAD_LETTER" },
      data: expect.objectContaining({
        status: "QUEUED",
        maxAttempts: { increment: 5 },
        deadLetteredAt: null,
      }),
    }));
    expect(activityCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        type: "SYSTEM",
        metadata: expect.objectContaining({
          notificationId: "notification-1",
          priorAttemptCount: 5,
          priorMaxAttempts: 5,
        }),
      }),
    }));
  });

  it("does not report success when a concurrent operator already changed the record", async () => {
    notificationUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const response = await POST(request(), routeContext);
    expect(response.status).toBe(409);
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("does not requeue a notification that is not dead-lettered", async () => {
    notificationFindFirstMock.mockResolvedValueOnce(null);
    const response = await POST(request(), routeContext);
    expect(response.status).toBe(404);
    expect(notificationUpdateManyMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });
});
