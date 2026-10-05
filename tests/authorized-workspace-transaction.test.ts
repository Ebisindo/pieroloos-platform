import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

const { transactionMock, membershipFindUniqueMock, workspaceFindFirstMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
  workspaceFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: transactionMock },
}));

import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["engagement:write"],
};

describe("authorized workspace transactions", () => {
  beforeEach(() => {
    transactionMock.mockReset().mockImplementation((callback) => callback({
      membership: { findUnique: membershipFindUniqueMock },
      workspace: { findFirst: workspaceFindFirstMock },
    }));
    membershipFindUniqueMock.mockReset().mockResolvedValue({ role: "OWNER" });
    workspaceFindFirstMock.mockReset().mockResolvedValue({ id: "workspace-1" });
  });

  it("revalidates live membership and workspace before mutation", async () => {
    await expect(withAuthorizedWorkspaceTransaction(principal, "engagement:write", async () => "committed"))
      .resolves.toBe("committed");
    expect(membershipFindUniqueMock).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: "user-1", organizationId: "org-1" } },
      select: { role: true },
    });
    expect(workspaceFindFirstMock).toHaveBeenCalledWith({
      where: { id: "workspace-1", organizationId: "org-1" },
      select: { id: true },
    });
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("rejects a role change that invalidates a request's principal", async () => {
    membershipFindUniqueMock.mockResolvedValue({ role: "VIEWER" });
    const operation = vi.fn();
    await expect(withAuthorizedWorkspaceTransaction(principal, "engagement:write", operation))
      .rejects.toThrow("WORKSPACE_AUTHORIZATION_STALE");
    expect(operation).not.toHaveBeenCalled();
  });

  it("rejects removed memberships and workspaces outside the organization", async () => {
    membershipFindUniqueMock.mockResolvedValue(null);
    await expect(withAuthorizedWorkspaceTransaction(principal, "engagement:write", async () => undefined))
      .rejects.toThrow("WORKSPACE_AUTHORIZATION_STALE");

    membershipFindUniqueMock.mockResolvedValue({ role: "OWNER" });
    workspaceFindFirstMock.mockResolvedValue(null);
    await expect(withAuthorizedWorkspaceTransaction(principal, "engagement:write", async () => undefined))
      .rejects.toThrow("WORKSPACE_AUTHORIZATION_STALE");
  });
});
