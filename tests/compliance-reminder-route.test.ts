import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

const mocks = vi.hoisted(() => {
  const transaction = {
    complianceObligation: { findFirst: vi.fn() },
    membership: { findUnique: vi.fn() },
    complianceNotification: { findUnique: vi.fn(), create: vi.fn() },
    complianceReminder: { create: vi.fn() },
    complianceActivity: { create: vi.fn() },
  };
  return {
    getWorkspaceContext: vi.fn(),
    withAuthorizedWorkspaceTransaction: vi.fn(async (_principal: unknown, _permission: unknown, operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction)),
    notificationFindFirst: vi.fn(),
    transaction,
  };
});

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: mocks.getWorkspaceContext }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: mocks.withAuthorizedWorkspaceTransaction,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { complianceNotification: { findFirst: mocks.notificationFindFirst } },
}));

import { POST } from "@/app/api/compliance/obligations/[id]/reminders/route";

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:write"],
};

const obligation = {
  id: "obligation-1",
  title: "Annual filing",
  status: "IN_PROGRESS",
  ownerUserId: "user-2",
};

function request(body: unknown) {
  return new Request("http://localhost/api/compliance/obligations/obligation-1/reminders", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function payload() {
  return {
    scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    channel: "IN_APP",
    message: "Please review the filing evidence.",
  };
}

describe("compliance reminder scheduling API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue({ userId: principal.userId, principal });
    mocks.transaction.complianceObligation.findFirst.mockResolvedValue(obligation);
    mocks.transaction.membership.findUnique.mockResolvedValue({ userId: "user-2" });
    mocks.transaction.complianceNotification.findUnique.mockResolvedValue(null);
    mocks.transaction.complianceNotification.create.mockResolvedValue({
      id: "notification-1",
      organizationId: principal.organizationId,
      workspaceId: principal.workspaceId,
      obligationId: obligation.id,
      recipientUserId: "user-2",
      channel: "IN_APP",
      subject: "Compliance reminder: Annual filing",
      body: payload().message,
      scheduledFor: new Date(payload().scheduledFor),
      status: "QUEUED",
      dedupeKey: "compliance-reminder:test",
    });
    mocks.transaction.complianceReminder.create.mockResolvedValue({ id: "reminder-1" });
    mocks.transaction.complianceActivity.create.mockResolvedValue({ id: "activity-1" });
  });

  it("rejects unauthenticated requests before opening a transaction", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({ userId: null, principal: null });
    const response = await POST(request(payload()), { params: Promise.resolve({ id: obligation.id }) });
    expect(response.status).toBe(401);
    expect(mocks.withAuthorizedWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it("denies principals without compliance write permission", async () => {
    mocks.getWorkspaceContext.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: ["compliance:read"] },
    });
    const response = await POST(request(payload()), { params: Promise.resolve({ id: obligation.id }) });
    expect(response.status).toBe(403);
    expect(mocks.withAuthorizedWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it("validates the request and rejects reminders scheduled in the past", async () => {
    const invalid = await POST(request({ channel: "SMS", message: "x", scheduledFor: "not-a-date" }), {
      params: Promise.resolve({ id: obligation.id }),
    });
    expect(invalid.status).toBe(422);

    const past = await POST(request({
      scheduledFor: "2020-01-01T00:00:00.000Z",
      channel: "IN_APP",
      message: "Please review this.",
    }), { params: Promise.resolve({ id: obligation.id }) });
    expect(past.status).toBe(422);
    expect(mocks.withAuthorizedWorkspaceTransaction).not.toHaveBeenCalled();
  });

  it("queues a workspace-scoped notification and records the reminder and audit activity", async () => {
    const body = payload();
    const response = await POST(request(body), { params: Promise.resolve({ id: obligation.id }) });
    const result = await response.json() as { alreadyScheduled: boolean };

    expect(response.status).toBe(201);
    expect(result.alreadyScheduled).toBe(false);
    expect(mocks.withAuthorizedWorkspaceTransaction).toHaveBeenCalledWith(
      principal,
      "compliance:write",
      expect.any(Function),
    );
    expect(mocks.transaction.complianceNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        obligationId: "obligation-1",
        recipientUserId: "user-2",
        channel: "IN_APP",
        nextAttemptAt: new Date(body.scheduledFor),
        templateKey: "legacy-notification",
      }),
    });
    expect(mocks.transaction.complianceReminder.create).toHaveBeenCalled();
    expect(mocks.transaction.complianceActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        obligationId: "obligation-1",
        action: "REMINDER_SCHEDULED",
        actorUserId: "user-1",
      }),
    });
  });

  it("returns the existing queued reminder on a repeated request", async () => {
    mocks.transaction.complianceNotification.findUnique.mockResolvedValue({ id: "notification-existing" });
    const response = await POST(request(payload()), { params: Promise.resolve({ id: obligation.id }) });
    const result = await response.json() as { alreadyScheduled: boolean; data: { id: string } };

    expect(response.status).toBe(200);
    expect(result.alreadyScheduled).toBe(true);
    expect(result.data.id).toBe("notification-existing");
    expect(mocks.transaction.complianceNotification.create).not.toHaveBeenCalled();
    expect(mocks.transaction.complianceReminder.create).not.toHaveBeenCalled();
    expect(mocks.transaction.complianceActivity.create).not.toHaveBeenCalled();
  });

  it("does not schedule reminders for closed obligations or out-of-organization recipients", async () => {
    mocks.transaction.complianceObligation.findFirst.mockResolvedValue({ ...obligation, status: "COMPLIANT" });
    const closed = await POST(request(payload()), { params: Promise.resolve({ id: obligation.id }) });
    expect(closed.status).toBe(409);

    mocks.transaction.complianceObligation.findFirst.mockResolvedValue(obligation);
    mocks.transaction.membership.findUnique.mockResolvedValue(null);
    const noRecipient = await POST(request(payload()), { params: Promise.resolve({ id: obligation.id }) });
    expect(noRecipient.status).toBe(409);
  });
});
