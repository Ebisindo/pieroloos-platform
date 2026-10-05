import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { PATCH as assignOwner } from "@/app/api/compliance/obligations/[id]/assignment/route";

const {
  getWorkspaceContextMock,
  obligationFindFirstMock,
  membershipFindFirstMock,
  obligationUpdateMock,
  activityCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  obligationFindFirstMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  obligationUpdateMock: vi.fn(),
  activityCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    complianceObligation: { findFirst: obligationFindFirstMock },
    membership: { findFirst: membershipFindFirstMock },
    $transaction: transactionMock,
  },
}));

const principal: WorkspacePrincipal = {
  userId: "manager-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  permissions: ["compliance:write"],
};

function request(body: unknown) {
  return new Request("http://localhost/api/compliance/obligations/obligation-1/assignment", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("compliance obligation assignment", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    obligationFindFirstMock.mockReset().mockResolvedValue({ id: "obligation-1", ownerUserId: "user-old" });
    membershipFindFirstMock.mockReset().mockResolvedValue({ userId: "user-new" });
    obligationUpdateMock.mockReset().mockResolvedValue({ id: "obligation-1", ownerUserId: "user-new" });
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    transactionMock.mockReset().mockImplementation((callback) => callback({
      complianceObligation: { update: obligationUpdateMock },
      complianceActivity: { create: activityCreateMock },
    }));
  });

  it("requires assigned owners to be members of the active organization and audits the assignment", async () => {
    const response = await assignOwner(request({ ownerUserId: "user-new" }), {
      params: Promise.resolve({ id: "obligation-1" }),
    });

    expect(response.status).toBe(200);
    expect(membershipFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-new", organizationId: "org-1" },
    }));
    expect(obligationUpdateMock).toHaveBeenCalledWith({
      where: { id: "obligation-1" },
      data: { ownerUserId: "user-new" },
    });
    expect(activityCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "OWNER_ASSIGNED",
        metadata: { previousOwnerUserId: "user-old", ownerUserId: "user-new" },
      }),
    }));
  });

  it("rejects assigning a non-member", async () => {
    membershipFindFirstMock.mockResolvedValue(null);
    const response = await assignOwner(request({ ownerUserId: "outsider" }), {
      params: Promise.resolve({ id: "obligation-1" }),
    });

    expect(response.status).toBe(422);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
