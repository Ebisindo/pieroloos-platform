import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { PATCH } from "@/app/api/workspaces/memberships/route";

const {
  getWorkspaceContextMock,
  transactionMock,
  membershipFindUniqueMock,
  workspaceFindFirstMock,
  membershipFindFirstMock,
  membershipCountMock,
  membershipUpdateManyMock,
  activityCreateMock,
  membershipResultMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  transactionMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
  workspaceFindFirstMock: vi.fn(),
  membershipFindFirstMock: vi.fn(),
  membershipCountMock: vi.fn(),
  membershipUpdateManyMock: vi.fn(),
  activityCreateMock: vi.fn(),
  membershipResultMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: transactionMock } }));

const principal: WorkspacePrincipal = {
  userId: "owner-user",
  organizationId: "organization-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["workspace:manage"],
};

function request(body: unknown) {
  return new Request("http://localhost/api/workspaces/memberships", {
    method: "PATCH",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("organization membership role management", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    membershipFindUniqueMock.mockReset().mockResolvedValue({ role: "OWNER" });
    workspaceFindFirstMock.mockReset().mockResolvedValue({ id: principal.workspaceId });
    membershipFindFirstMock.mockReset().mockResolvedValue({
      id: "membership-2",
      userId: "member-2",
      role: "MEMBER",
    });
    membershipCountMock.mockReset().mockResolvedValue(2);
    membershipUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    activityCreateMock.mockReset().mockResolvedValue({ id: "audit-1" });
    membershipResultMock.mockReset().mockResolvedValue({
      id: "membership-2",
      role: "ADMIN",
      user: { id: "member-2", email: "member@example.com", name: "Member" },
    });
    transactionMock.mockReset().mockImplementation((callback) => callback({
      membership: {
        findUnique: membershipFindUniqueMock,
        findFirst: membershipFindFirstMock,
        count: membershipCountMock,
        updateMany: membershipUpdateManyMock,
      },
      workspace: { findFirst: workspaceFindFirstMock },
      activity: { create: activityCreateMock },
    }));
    membershipFindFirstMock.mockImplementation(async (args) => {
      if (args.select?.user) return membershipResultMock();
      return { id: "membership-2", userId: "member-2", role: "MEMBER" };
    });
  });

  it("allows an owner to update only a membership in the active organization and audits the change", async () => {
    const response = await PATCH(request({ membershipId: "membership-2", role: "ADMIN" }));
    expect(response.status).toBe(200);
    expect(membershipFindFirstMock).toHaveBeenCalledWith({
      where: { id: "membership-2", organizationId: "organization-1" },
      select: { id: true, userId: true, role: true },
    });
    expect(membershipUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "membership-2", organizationId: "organization-1", role: "MEMBER" },
      data: { role: "ADMIN" },
    });
    expect(activityCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: "owner-user",
        metadata: expect.objectContaining({ subjectUserId: "member-2", fromRole: "MEMBER", toRole: "ADMIN" }),
      }),
    }));
  });

  it("denies non-owners before reading or changing membership roles", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: "admin-user",
      principal: { ...principal, userId: "admin-user", role: "admin" },
    });
    const response = await PATCH(request({ membershipId: "membership-2", role: "OWNER" }));
    expect(response.status).toBe(403);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("prevents demoting the last owner", async () => {
    membershipFindFirstMock.mockResolvedValue({ id: "membership-2", userId: "member-2", role: "OWNER" });
    membershipCountMock.mockResolvedValue(1);
    const response = await PATCH(request({ membershipId: "membership-2", role: "ADMIN" }));
    expect(response.status).toBe(409);
    expect(membershipUpdateManyMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("rejects mutations without browser origin or referer", async () => {
    const response = await PATCH(new Request("http://localhost/api/workspaces/memberships", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ membershipId: "membership-2", role: "ADMIN" }),
    }));
    expect(response.status).toBe(403);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
