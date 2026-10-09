import { beforeEach, describe, expect, it, vi } from "vitest";
import { withClientPortalGrantTransaction } from "@/lib/auth/client-portal-access";
import type { ClientPortalPrincipal } from "@/lib/auth/client-portal-access";

const { prismaMock, grantFindFirst, transaction } = vi.hoisted(() => {
  const grantFindFirst = vi.fn();
  const transaction = { clientPortalGrant: { findFirst: grantFindFirst } };
  const prismaMock = {
    $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction)),
  };
  return { prismaMock, grantFindFirst, transaction };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

const principal: ClientPortalPrincipal = {
  userId: "client-user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  clientId: "client-1",
  clientPortalGrantId: "grant-1",
};

describe("client portal grant authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revalidates exact grant, user, client, workspace, expiry, and requested capability transactionally", async () => {
    grantFindFirst.mockResolvedValue({ id: "grant-1" });
    const operation = vi.fn(async () => "allowed");

    await expect(withClientPortalGrantTransaction(principal, "UPLOAD_EVIDENCE", operation))
      .resolves.toBe("allowed");

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(grantFindFirst).toHaveBeenCalledWith({
      where: {
        id: "grant-1",
        organizationId: "org-1",
        workspaceId: "workspace-1",
        clientId: "client-1",
        userId: "client-user-1",
        revokedAt: null,
        OR: expect.any(Array),
        canUploadEvidence: true,
      },
      select: { id: true },
    });
    expect(operation).toHaveBeenCalledOnce();
  });

  it("rejects revoked, expired, or out-of-scope access without running the operation", async () => {
    grantFindFirst.mockResolvedValue(null);
    const operation = vi.fn();

    await expect(withClientPortalGrantTransaction(principal, "VIEW_TASKS", operation))
      .rejects.toThrow("CLIENT_PORTAL_ACCESS_REVOKED");

    expect(grantFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: principal.userId,
        clientId: principal.clientId,
        workspaceId: principal.workspaceId,
        canViewTasks: true,
      }),
    }));
    expect(operation).not.toHaveBeenCalled();
  });
});
