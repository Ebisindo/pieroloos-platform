import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  notificationFindManyMock, notificationUpdateManyMock, notificationFindUniqueOrThrowMock,
  attemptCreateMock, attemptUpdateMock, attemptUpdateManyMock, userFindUniqueMock,
  preferenceFindUniqueMock, workspaceFindFirstMock, membershipFindFirstMock,
  workspaceSettingsFindUniqueMock, transactionMock, sendEmailMock,
} = vi.hoisted(() => ({
  notificationFindManyMock: vi.fn(), notificationUpdateManyMock: vi.fn(),
  notificationFindUniqueOrThrowMock: vi.fn(), attemptCreateMock: vi.fn(),
  attemptUpdateMock: vi.fn(), attemptUpdateManyMock: vi.fn(), userFindUniqueMock: vi.fn(),
  preferenceFindUniqueMock: vi.fn(), workspaceFindFirstMock: vi.fn(), membershipFindFirstMock: vi.fn(),
  workspaceSettingsFindUniqueMock: vi.fn(), transactionMock: vi.fn(), sendEmailMock: vi.fn(),
}));
const transaction = {
  complianceNotification: { findMany: notificationFindManyMock, updateMany: notificationUpdateManyMock, findUniqueOrThrow: notificationFindUniqueOrThrowMock },
  notificationDeliveryAttempt: { create: attemptCreateMock, update: attemptUpdateMock, updateMany: attemptUpdateManyMock },
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
vi.mock("@/lib/services/notification-email", () => ({ sendNotificationEmail: sendEmailMock }));
import { runNotificationWorker } from "@/lib/services/notification-worker";

const baseNotification = {
  id: "notice-1", organizationId: "org-1", workspaceId: "workspace-1",
  recipientUserId: null, channel: "EMAIL" as const, subject: "Continuity notice",
  body: "Secure notice.\nInvitation recipient: founder@example.test",
  templateKey: "legacy-notification", templateVersion: 1, status: "QUEUED",
  attemptCount: 0, maxAttempts: 5, lockedBy: null,
  scheduledFor: new Date("2026-10-01T00:00:00Z"), createdAt: new Date("2026-10-01T00:00:00Z"),
};

describe("account-less notification delivery scope", () => {
  beforeEach(() => {
    notificationFindManyMock.mockReset().mockResolvedValue([{ ...baseNotification, dedupeKey: "successor-invite-s1" }]);
    notificationUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    notificationFindUniqueOrThrowMock.mockReset().mockResolvedValue({ attemptCount: 1 });
    attemptCreateMock.mockReset().mockResolvedValue({ id: "attempt-1" });
    attemptUpdateMock.mockReset().mockResolvedValue({});
    attemptUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    userFindUniqueMock.mockReset().mockResolvedValue({ id: "user-1", email: "owner@example.test" });
    preferenceFindUniqueMock.mockReset().mockResolvedValue({ inAppEnabled: true, emailEnabled: true, quietHoursStart: null, quietHoursEnd: null, timezone: "UTC", locale: "en" });
    workspaceFindFirstMock.mockReset().mockResolvedValue({ id: "workspace-1", organizationId: "org-1" });
    membershipFindFirstMock.mockReset().mockResolvedValue({ id: "membership-1" });
    workspaceSettingsFindUniqueMock.mockReset().mockResolvedValue({ notificationsEnabled: true });
    transactionMock.mockReset().mockImplementation(async (operation) => typeof operation === "function" ? operation(transaction) : Promise.all(operation));
    sendEmailMock.mockReset().mockResolvedValue({ messageId: "<receipt@example.test>", response: "250 accepted" });
  });

  it("sends only explicitly marked continuity emails to the embedded recipient and strips the marker", async () => {
    const result = await runNotificationWorker(new Date("2026-10-01T01:00:00Z"));
    expect(result).toMatchObject({ delivered: 1, cancelled: 0 });
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      recipientEmail: "founder@example.test",
      body: "Secure notice.",
    }));
  });

  it("cancels account-less notifications that are not continuity-prefixed", async () => {
    notificationFindManyMock.mockResolvedValueOnce([{ ...baseNotification, dedupeKey: "generic-alert" }]);
    const result = await runNotificationWorker(new Date("2026-10-01T01:00:00Z"));
    expect(result).toMatchObject({ delivered: 0, cancelled: 1 });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
