# Governance regression coverage for scoped portal grants

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { updateClientPortalGrant } from "@/lib/services/client-portal-service";
import { clientPortalGrantUpdateSchema } from "@/lib/validation/client-portal";

const { transactionMock, grantFindFirst, grantUpdate, auditCreate } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  grantFindFirst: vi.fn(),
  grantUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: vi.fn(async (
    _principal: unknown,
    _permission: unknown,
    operation: (tx: unknown) => Promise<unknown>,
  ) => operation({
    clientPortalGrant: { findFirst: grantFindFirst, update: grantUpdate },
    clientPortalAuditEvent: { create: auditCreate },
  })),
}));
vi.mock("@/lib/storage/s3-object-storage", () => ({ getS3ObjectStorage: vi.fn() }));

const principal: WorkspacePrincipal = {
  userId: "owner-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["client:write"],
};

describe("client portal grant lifecycle controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grantFindFirst.mockResolvedValue({ id: "grant-1", clientId: "client-1", revokedAt: null, expiresAt: null });
    grantUpdate.mockResolvedValue({ id: "grant-1", expiresAt: new Date("2027-01-01T00:00:00.000Z") });
    auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("rejects past expiry and strict unknown fields", () => {
    expect(clientPortalGrantUpdateSchema.safeParse({
      expiresAt: "2020-01-01T00:00:00.000Z",
      canViewStatus: true,
      canViewTasks: true,
      canUploadEvidence: true,
    }).success).toBe(false);
    expect(clientPortalGrantUpdateSchema.safeParse({
      expiresAt: null,
      canViewStatus: true,
      canViewTasks: true,
      canUploadEvidence: true,
      platformAdmin: true,
    }).success).toBe(false);
  });

  it("updates only a grant in the active client, organization and workspace and writes audit metadata", async () => {
    await updateClientPortalGrant("client-1", "grant-1", {
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
      canViewStatus: true,
      canViewTasks: false,
      canUploadEvidence: false,
    }, principal);

    expect(grantFindFirst).toHaveBeenCalledWith({
      where: {
        id: "grant-1",
        clientId: "client-1",
        organizationId: "org-1",
        workspaceId: "workspace-1",
      },
      select: { id: true, clientId: true, revokedAt: true, expiresAt: true },
    });
    expect(grantUpdate).toHaveBeenCalledWith({
      where: { id: "grant-1" },
      data: expect.objectContaining({ canViewTasks: false, canUploadEvidence: false }),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        clientId: "client-1",
        grantId: "grant-1",
        actorUserId: "owner-1",
        action: "ACCESS_UPDATED",
      }),
    });
  });

  it("does not mutate a revoked or foreign grant", async () => {
    grantFindFirst.mockResolvedValue(null);
    await expect(updateClientPortalGrant("client-1", "foreign-grant", {
      expiresAt: null,
      canViewStatus: true,
      canViewTasks: true,
      canUploadEvidence: true,
    }, principal)).rejects.toThrow("CLIENT_PORTAL_GRANT_NOT_FOUND");
    expect(grantUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
