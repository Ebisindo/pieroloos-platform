import { beforeEach, describe, expect, it, vi } from "vitest";
import { runOperationalEscalationWorker } from "@/lib/services/operational-escalation-worker";

const {
  findManyMock,
  transactionMock,
  updateManyMock,
  escalationCreateMock,
  notificationUpsertMock,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  transactionMock: vi.fn(),
  updateManyMock: vi.fn(),
  escalationCreateMock: vi.fn(),
  notificationUpsertMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    operationalAction: { findMany: findManyMock },
    $transaction: transactionMock,
  },
}));

const dueAction = {
  id: "action-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  title: "Submit evidence",
  description: null,
  sourceSignalId: "evidence-gap:obligation-1",
  clientId: null,
  engagementId: null,
  documentId: null,
  complianceObligationId: "obligation-1",
  assigneeUserId: "user-2",
  createdByUserId: "user-1",
  priority: "CRITICAL",
  status: "OPEN",
  dueAt: new Date("2026-10-01T00:00:00.000Z"),
  escalationLevel: 0,
  escalationAt: null,
  resolvedAt: null,
  resolutionNote: null,
  createdAt: new Date("2026-09-30T00:00:00.000Z"),
  updatedAt: new Date("2026-09-30T00:00:00.000Z"),
};

describe("operational escalation worker", () => {
  beforeEach(() => {
    findManyMock.mockReset().mockResolvedValue([dueAction]);
    transactionMock.mockReset().mockImplementation((callback) => callback({
      operationalAction: { updateMany: updateManyMock },
      operationalEscalationEvent: { create: escalationCreateMock },
      complianceNotification: { upsert: notificationUpsertMock },
    }));
    updateManyMock.mockReset().mockResolvedValue({ count: 1 });
    escalationCreateMock.mockReset().mockResolvedValue({});
    notificationUpsertMock.mockReset().mockResolvedValue({});
  });

  it("records an escalation and notification atomically after claiming the action", async () => {
    const now = new Date("2026-10-03T00:00:00.000Z");

    const result = await runOperationalEscalationWorker(now);

    expect(result).toEqual({ evaluated: 1, escalatedActionIds: ["action-1"] });
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        escalationLevel: 0,
        updatedAt: dueAction.updatedAt,
      }),
      data: expect.objectContaining({ escalationLevel: 1, escalationAt: now }),
    }));
    expect(escalationCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actionId: "action-1", fromLevel: 0, toLevel: 1 }),
    }));
    expect(notificationUpsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId_workspaceId_dedupeKey: {
        organizationId: "org-1",
        workspaceId: "workspace-1",
        dedupeKey: "escalation:action-1:1",
      } },
      create: expect.objectContaining({ recipientUserId: "user-2", status: "QUEUED" }),
    }));
  });

  it("does not append duplicate events or notifications when another worker wins the claim", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    const result = await runOperationalEscalationWorker(new Date("2026-10-03T00:00:00.000Z"));

    expect(result.escalatedActionIds).toEqual([]);
    expect(escalationCreateMock).not.toHaveBeenCalled();
    expect(notificationUpsertMock).not.toHaveBeenCalled();
  });
});
