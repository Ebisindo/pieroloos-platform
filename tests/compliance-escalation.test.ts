import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { POST } from "@/app/api/compliance/escalations/route";

const {
  getWorkspaceContextMock, hasInvalidRequestOriginMock, authorizedTransactionMock,
  obligationFindFirstMock, notificationFindUniqueMock, notificationCreateMock,
  membershipFindUniqueMock, obligationUpdateManyMock, activityCreateMock,
  globalNotificationFindFirstMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  obligationFindFirstMock: vi.fn(),
  notificationFindUniqueMock: vi.fn(),
  notificationCreateMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
  obligationUpdateManyMock: vi.fn(),
  activityCreateMock: vi.fn(),
  globalNotificationFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: hasInvalidRequestOriginMock }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { complianceNotification: { findFirst: globalNotificationFindFirstMock } },
}));

const principal: WorkspacePrincipal = {
  userId: "manager-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:write"],
};

const payload = (overrides: Record<string, unknown> = {}) => ({
  obligationId: "obligation-1",
  reason: "Required evidence has not been received after the internal deadline.",
  idempotencyKey: "escalation-request-001",
  ...overrides,
});
function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/compliance/escalations", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("scoped compliance escalation workflow", () => {
  beforeEach(() => {
    hasInvalidRequestOriginMock.mockReset().mockReturnValue(false);
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    obligationFindFirstMock.mockReset().mockResolvedValue({
      id: "obligation-1",
      title: "Annual filing",
      status: "IN_PROGRESS",
      ownerUserId: "owner-2",
      escalationLevel: 0,
    });
    notificationFindUniqueMock.mockReset().mockResolvedValue(null);
    membershipFindUniqueMock.mockReset().mockResolvedValue({ userId: "owner-2" });
    obligationUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    notificationCreateMock.mockReset().mockImplementation(async ({ data }) => ({
      id: "notification-1",
      status: "QUEUED",
      body: data.body,
      templateParams: data.templateParams,
      dedupeKey: data.dedupeKey,
    }));
    globalNotificationFindFirstMock.mockReset().mockResolvedValue(null);
    authorizedTransactionMock.mockReset().mockImplementation(async (_principal, _permission, operation) => operation({
      complianceObligation: { findFirst: obligationFindFirstMock, updateMany: obligationUpdateManyMock },
      complianceNotification: { findUnique: notificationFindUniqueMock, create: notificationCreateMock },
      membership: { findUnique: membershipFindUniqueMock },
      complianceActivity: { create: activityCreateMock },
    }));
  });

  it("rejects invalid origins before authentication or transaction work", async () => {
    hasInvalidRequestOriginMock.mockReturnValue(true);
    const response = await POST(request(payload(), "https://attacker.invalid"));
    expect(response.status).toBe(403);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("requires compliance write permission", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: ["compliance:read"] },
    });
    const response = await POST(request(payload()));
    expect(response.status).toBe(403);
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("increments the level, queues a scoped notification and audits the action in the transaction", async () => {
    const response = await POST(request(payload()));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { id: "notification-1", status: "QUEUED" },
      alreadyEscalated: false,
      escalationLevel: 1,
    });
    expect(obligationUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: "obligation-1",
        organizationId: "org-1",
        workspaceId: "workspace-1",
        status: "IN_PROGRESS",
        escalationLevel: 0,
      },
      data: { escalationLevel: 1 },
    });
    expect(notificationCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        obligationId: "obligation-1",
        recipientUserId: "owner-2",
        channel: "IN_APP",
        templateKey: "compliance-escalation",
        dedupeKey: expect.stringMatching(/^compliance-escalation:obligation-1:/),
      }),
    });
    expect(activityCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        obligationId: "obligation-1",
        action: "OBLIGATION_ESCALATED",
        actorUserId: "manager-1",
        metadata: expect.objectContaining({
          previousEscalationLevel: 0,
          escalationLevel: 1,
          targetUserId: "owner-2",
          notificationId: "notification-1",
        }),
      }),
    });
  });

  it("returns the previously created notification on a retry without escalating twice", async () => {
    const input = payload();
    const existing = {
      id: "notification-existing",
      status: "QUEUED",
      body: input.reason,
      templateParams: {
        reasonDigest: createHash("sha256").update(String(input.reason)).digest("hex"),
        requestTargetUserId: null,
        escalationLevel: 1,
      },
    };
    notificationFindUniqueMock.mockResolvedValueOnce(existing);
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { id: "notification-existing" }, alreadyEscalated: true, escalationLevel: 1 });
    expect(obligationUpdateManyMock).not.toHaveBeenCalled();
    expect(notificationCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("rejects reuse of an idempotency key with a different reason", async () => {
    notificationFindUniqueMock.mockResolvedValueOnce({
      id: "notification-existing",
      body: "A different reason was previously recorded.",
      templateParams: {
        reasonDigest: createHash("sha256").update("A different reason was previously recorded.").digest("hex"),
        requestTargetUserId: null,
        escalationLevel: 1,
      },
    });
    const response = await POST(request(payload()));
    expect(response.status).toBe(409);
    expect(obligationUpdateManyMock).not.toHaveBeenCalled();
  });

  it("rejects a target outside the organization and never increments the escalation level", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce(null);
    const response = await POST(request(payload({ targetUserId: "outsider" })));
    expect(response.status).toBe(422);
    expect(obligationUpdateManyMock).not.toHaveBeenCalled();
    expect(notificationCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("refuses escalation for closed obligations and after the configured limit", async () => {
    obligationFindFirstMock.mockResolvedValueOnce({
      id: "obligation-1", title: "Annual filing", status: "COMPLIANT", ownerUserId: "owner-2", escalationLevel: 0,
    });
    const closed = await POST(request(payload()));
    expect(closed.status).toBe(409);
    expect(obligationUpdateManyMock).not.toHaveBeenCalled();

    obligationFindFirstMock.mockResolvedValueOnce({
      id: "obligation-1", title: "Annual filing", status: "IN_PROGRESS", ownerUserId: "owner-2", escalationLevel: 5,
    });
    const limited = await POST(request(payload({ idempotencyKey: "escalation-request-002" })));
    expect(limited.status).toBe(409);
    expect(obligationUpdateManyMock).not.toHaveBeenCalled();
  });

  it("denies an obligation outside the active workspace", async () => {
    obligationFindFirstMock.mockResolvedValueOnce(null);
    const response = await POST(request(payload()));
    expect(response.status).toBe(404);
    expect(notificationFindUniqueMock).not.toHaveBeenCalled();
    expect(obligationUpdateManyMock).not.toHaveBeenCalled();
  });

  it("returns a conflict without notification or audit activity if the level changed concurrently", async () => {
    obligationUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const response = await POST(request(payload()));
    expect(response.status).toBe(409);
    expect(notificationCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("resolves a concurrent unique-key race only to the scoped matching request", async () => {
    notificationCreateMock.mockRejectedValueOnce({ code: "P2002" });
    globalNotificationFindFirstMock.mockResolvedValueOnce({
      id: "notification-raced",
      status: "QUEUED",
      obligationId: "obligation-1",
      body: payload().reason,
      templateParams: {
        reasonDigest: createHash("sha256").update(String(payload().reason)).digest("hex"),
        requestTargetUserId: null,
        escalationLevel: 1,
      },
    });
    const response = await POST(request(payload()));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { id: "notification-raced" }, alreadyEscalated: true, escalationLevel: 1 });
    expect(globalNotificationFindFirstMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        obligationId: "obligation-1",
      }),
    });
  });
});
