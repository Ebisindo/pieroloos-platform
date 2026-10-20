import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { POST } from "@/app/api/control-plane/actions/[id]/assign/route";

const {
  getWorkspaceContextMock,
  actionFindFirstMock,
  membershipFindFirstMock,
  transactionMock,
  updateManyMock,
  transactionActionFindFirstMock,
  auditCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  actionFindFirstMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  updateManyMock: vi.fn(),
  transactionActionFindFirstMock: vi.fn(),
  auditCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    operationalAction: { findFirst: actionFindFirstMock },
    membership: { findFirst: membershipFindFirstMock },
    $transaction: transactionMock,
  },
}));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:write"],
};

const updatedAt = new Date("2026-10-01T12:00:00.000Z");
const actionRecord = {
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
  assigneeUserId: null,
  createdByUserId: "user-1",
  priority: "HIGH",
  status: "OPEN",
  dueAt: null,
  escalationLevel: 0,
  escalationAt: null,
  resolvedAt: null,
  resolutionNote: null,
  createdAt: updatedAt,
  updatedAt,
};

function makeRequest(origin = "http://localhost") {
  return new Request("http://localhost/api/control-plane/actions/action-1/assign", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      assigneeUserId: "user-2",
      expectedUpdatedAt: updatedAt.toISOString(),
    }),
  });
}

describe("operational action assignment", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    actionFindFirstMock.mockReset().mockResolvedValue(actionRecord);
    membershipFindFirstMock.mockReset().mockResolvedValue({ id: "membership-2" });
    transactionMock.mockReset().mockImplementation((callback) => callback({
      membership: {
        findUnique: vi.fn().mockResolvedValue({ role: "OWNER" }),
        findFirst: membershipFindFirstMock,
      },
      workspace: { findFirst: vi.fn().mockResolvedValue({ id: "workspace-1" }) },
      operationalAction: {
        updateMany: updateManyMock,
        findFirst: transactionActionFindFirstMock,
      },
      operationalActionAuditEvent: { create: auditCreateMock },
    }));
    updateManyMock.mockReset().mockResolvedValue({ count: 1 });
    transactionActionFindFirstMock.mockReset().mockResolvedValue({
      ...actionRecord,
      assigneeUserId: "user-2",
      status: "ASSIGNED",
      updatedAt: new Date("2026-10-01T12:01:00.000Z"),
    });
    auditCreateMock.mockReset().mockResolvedValue({});
  });

  it("assigns an organization member with compare-and-swap and a durable audit event", async () => {
    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "action-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { status: "ASSIGNED", assigneeUserId: "user-2" },
    });
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        updatedAt,
      }),
      data: expect.objectContaining({ assigneeUserId: "user-2", status: "ASSIGNED" }),
    }));
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actionId: "action-1",
        actorUserId: "user-1",
        eventType: "ACTION_ASSIGNED",
      }),
    }));
  });

  it("rejects assignees outside the active organization", async () => {
    membershipFindFirstMock.mockResolvedValue(null);

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "action-1" }) });

    expect(response.status).toBe(422);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("reports a concurrent assignment conflict without writing an audit event", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    const response = await POST(makeRequest(), { params: Promise.resolve({ id: "action-1" }) });

    expect(response.status).toBe(409);
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin assignment requests", async () => {
    const response = await POST(makeRequest("https://attacker.example"), {
      params: Promise.resolve({ id: "action-1" }),
    });

    expect(response.status).toBe(403);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
  });
});
