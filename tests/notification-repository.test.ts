import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { notificationRepository } from "@/lib/db/notification-repository";

const {
  notificationFindFirstMock,
  notificationFindManyMock,
  notificationUpsertMock,
} = vi.hoisted(() => ({
  notificationFindFirstMock: vi.fn(),
  notificationFindManyMock: vi.fn(),
  notificationUpsertMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    complianceNotification: {
      findFirst: notificationFindFirstMock,
      findMany: notificationFindManyMock,
      upsert: notificationUpsertMock,
    },
  },
}));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:read", "compliance:write"],
};

describe("notification repository", () => {
  beforeEach(() => {
    notificationFindFirstMock.mockReset();
    notificationFindManyMock.mockReset();
    notificationUpsertMock.mockReset();
  });

  it("lists only the signed-in recipient's channel deliveries in the active workspace", async () => {
    notificationFindManyMock.mockResolvedValue([{
      id: "notification-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      recipientUserId: "user-1",
      channel: "IN_APP",
      subject: "Action escalated",
      body: "An action needs attention.",
      scheduledFor: new Date("2026-10-02T00:00:00Z"),
      status: "QUEUED",
      dedupeKey: "escalation:action-1:1",
      createdAt: new Date("2026-10-02T00:00:00Z"),
    }]);

    const result = await notificationRepository.listForRecipient(principal);

    expect(result).toHaveLength(1);
    expect(notificationFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        recipientUserId: "user-1",
        status: { not: "CANCELLED" },
      }),
    }));
    expect(notificationFindManyMock.mock.calls[0][0].where).not.toHaveProperty("channel");
  });

  it("requires compliance-read permission to view in-app notices", async () => {
    await expect(notificationRepository.listForRecipient({
      ...principal,
      permissions: [],
    })).rejects.toThrow("Forbidden: compliance:read");

    expect(notificationFindManyMock).not.toHaveBeenCalled();
  });

  it("finds a matching dedupe record within the tenant scope", async () => {
    notificationFindFirstMock.mockResolvedValue({
      id: "notification-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      dedupeKey: "escalation:action-1:1",
      channel: "IN_APP",
      subject: "Action escalated to level 1",
      body: "Action escalated.",
      scheduledFor: new Date("2026-10-02T00:00:00Z"),
      status: "QUEUED",
    });

    const result = await notificationRepository.findByDedupeKey("escalation:action-1:1", principal);

    expect(result).toMatchObject({ dedupeKey: "escalation:action-1:1", organizationId: "org-1" });
    expect(notificationFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        dedupeKey: "escalation:action-1:1",
      }),
    }));
  });

  it("persists a notification with the tenant and dedupe identity", async () => {
    notificationUpsertMock.mockResolvedValue({
      id: "notification-2",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      dedupeKey: "escalation:action-1:2",
      recipientUserId: "user-2",
      channel: "IN_APP",
      subject: "Action escalated to level 2",
      body: "Escalation continued.",
      scheduledFor: new Date("2026-10-02T00:00:00Z"),
      status: "QUEUED",
      createdAt: new Date("2026-10-02T00:00:00Z"),
    });

    const result = await notificationRepository.enqueue({
      id: "notification-2",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      obligationId: "obligation-1",
      recipientUserId: "user-2",
      channel: "IN_APP",
      subject: "Action escalated to level 2",
      body: "Escalation continued.",
      scheduledFor: new Date("2026-10-02T00:00:00Z"),
      status: "QUEUED",
      dedupeKey: "escalation:action-1:2",
    }, principal);

    expect(result.dedupeKey).toBe("escalation:action-1:2");
    expect(notificationUpsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_workspaceId_dedupeKey: {
        organizationId: "org-1",
        workspaceId: "workspace-1",
        dedupeKey: "escalation:action-1:2",
      } },
      create: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        dedupeKey: "escalation:action-1:2",
      }),
      update: {},
    }));
  });

  it("rejects attempts to enqueue into another workspace", async () => {
    await expect(notificationRepository.enqueue({
      organizationId: "org-1",
      workspaceId: "workspace-2",
      recipientUserId: "user-2",
      channel: "IN_APP",
      subject: "Action escalated",
      body: "Escalation continued.",
      scheduledFor: new Date("2026-10-02T00:00:00Z"),
      dedupeKey: "escalation:action-1:2",
    }, principal)).rejects.toThrow("Forbidden: workspace boundary violation");

    expect(notificationUpsertMock).not.toHaveBeenCalled();
  });
});
