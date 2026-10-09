import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  notificationFindManyMock,
  notificationUpdateManyMock,
  notificationFindUniqueOrThrowMock,
  attemptCreateMock,
  attemptUpdateMock,
  userFindUniqueMock,
  preferenceFindUniqueMock,
  workspaceFindFirstMock,
  membershipFindFirstMock,
  workspaceSettingsFindUniqueMock,
  transactionMock,
  sendEmailMock,
} = vi.hoisted(() => ({
  notificationFindManyMock: vi.fn(),
  notificationUpdateManyMock: vi.fn(),
  notificationFindUniqueOrThrowMock: vi.fn(),
  attemptCreateMock: vi.fn(),
  attemptUpdateMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  preferenceFindUniqueMock: vi.fn(),
  workspaceFindFirstMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  workspaceSettingsFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

const transaction = {
  complianceNotification: {
    findMany: notificationFindManyMock,
    updateMany: notificationUpdateManyMock,
    findUniqueOrThrow: notificationFindUniqueOrThrowMock,
  },
  notificationDeliveryAttempt: {
    create: attemptCreateMock,
    update: attemptUpdateMock,
  },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    complianceNotification: { updateMany: notificationUpdateManyMock },
    notificationDeliveryAttempt: { update: attemptUpdateMock },
    user: { findUnique: userFindUniqueMock },
    notificationPreference: { findUnique: preferenceFindUniqueMock },
    workspace: { findFirst: workspaceFindFirstMock },
    membership: { findFirst: membershipFindFirstMock },
    workspaceSettings: { findUnique: workspaceSettingsFindUniqueMock },
  },
}));
vi.mock("@/lib/services/notification-email", () => ({
  sendNotificationEmail: sendEmailMock,
}));

import { runNotificationWorker } from "@/lib/services/notification-worker";

const queuedEmail = {
  id: "notification-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  recipientUserId: "user-1",
  channel: "EMAIL" as const,
  subject: "Action needs attention",
  body: "Please review.",
  templateKey: "operational-action-escalation",
  templateVersion: 1,
  status: "QUEUED",
  attemptCount: 0,
  maxAttempts: 5,
  lockedBy: null,
  scheduledFor: new Date("2026-10-06T06:00:00Z"),
  createdAt: new Date("2026-10-06T05:00:00Z"),
};

describe("notification background worker", () => {
  beforeEach(() => {
    notificationFindManyMock.mockReset().mockResolvedValue([queuedEmail]);
    notificationUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    notificationFindUniqueOrThrowMock.mockReset().mockResolvedValue({ attemptCount: 1 });
    attemptCreateMock.mockReset().mockResolvedValue({ id: "attempt-1" });
    attemptUpdateMock.mockReset().mockResolvedValue({});
    userFindUniqueMock.mockReset().mockResolvedValue({ id: "user-1", email: "user@example.com" });
    preferenceFindUniqueMock.mockReset().mockResolvedValue({
      inAppEnabled: true,
      emailEnabled: true,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "UTC",
    });
    workspaceFindFirstMock.mockReset().mockResolvedValue({ id: "workspace-1", organizationId: "org-1" });
    membershipFindFirstMock.mockReset().mockResolvedValue({ id: "membership-1" });
    workspaceSettingsFindUniqueMock.mockReset().mockResolvedValue({ notificationsEnabled: true });
    transactionMock.mockReset().mockImplementation(async (operation) =>
      typeof operation === "function" ? operation(transaction) : Promise.all(operation),
    );
    sendEmailMock.mockReset().mockResolvedValue({
      messageId: "<receipt@example.com>",
      response: "250 accepted",
    });
  });

  it("records provider acceptance as a delivery receipt", async () => {
    const result = await runNotificationWorker(new Date("2026-10-06T06:30:00Z"));

    expect(result).toMatchObject({ claimed: 1, delivered: 1, retried: 0, deadLettered: 0 });
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "notification-1",
      recipientEmail: "user@example.com",
      templateVersion: 1,
    }));
    expect(attemptUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ACCEPTED", providerMessageId: "<receipt@example.com>" }),
    }));
    expect(notificationUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "SENT",
        deliveryReceipt: "250 accepted",
      }),
    }));
  });

  it("uses bounded retry scheduling and records sanitized failures", async () => {
    const timeout = Object.assign(new Error("connection timed out with private server details"), { code: "ETIMEDOUT" });
    sendEmailMock.mockRejectedValueOnce(timeout);
    const now = new Date("2026-10-06T06:30:00Z");

    const result = await runNotificationWorker(now);

    expect(result).toMatchObject({ retried: 1, deadLettered: 0 });
    expect(attemptUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "RETRYABLE_FAILURE",
        failureCode: "ETIMEDOUT",
        failureMessage: "Notification delivery failed (ETIMEDOUT).",
      }),
    }));
    expect(notificationUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "QUEUED",
        nextAttemptAt: new Date(now.getTime() + 30_000),
      }),
    }));
  });

  it("cancels email when the recipient has not opted in", async () => {
    preferenceFindUniqueMock.mockResolvedValueOnce({
      inAppEnabled: true,
      emailEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "UTC",
    });

    const result = await runNotificationWorker();

    expect(result.cancelled).toBe(1);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(attemptCreateMock).not.toHaveBeenCalled();
    expect(notificationUpdateManyMock).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "CANCELLED",
        failureReason: "RECIPIENT_PREFERENCE_DISABLED",
      }),
    }));
  });

  it("defers email into the recipient's quiet hours without consuming a retry", async () => {
    preferenceFindUniqueMock.mockResolvedValueOnce({
      inAppEnabled: true,
      emailEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      timezone: "UTC",
    });
    const now = new Date("2026-10-06T23:30:00Z");

    const result = await runNotificationWorker(now);

    expect(result.deferred).toBe(1);
    expect(attemptCreateMock).not.toHaveBeenCalled();
    expect(notificationUpdateManyMock).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "QUEUED",
        scheduledFor: new Date("2026-10-07T07:00:00Z"),
      }),
    }));
  });
});
