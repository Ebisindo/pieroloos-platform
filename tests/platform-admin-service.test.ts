import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformPermission, Prisma } from "@prisma/client";

const { transactionMock, tx } = vi.hoisted(() => {
  const tx = {
    platformSuperAdmin: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    platformAdministrator: { upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    platformAdministratorPermission: { deleteMany: vi.fn(), createMany: vi.fn() },
    platformAuditEvent: { create: vi.fn() },
  };
  return {
    tx,
    transactionMock: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: transactionMock },
}));

import {
  revokePlatformAdministrator,
  setPlatformAdministratorPermissions,
} from "@/lib/services/platform-admin-service";

const actor = {
  userId: "super-1",
  email: "super@example.test",
  isSuperAdmin: true,
  permissions: [],
  organizationIds: [],
};

describe("platform administrator mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.platformSuperAdmin.findUnique.mockResolvedValue({ userId: actor.userId });
    tx.user.findUnique.mockResolvedValue({
      id: "staff-1",
      memberships: [{ id: "membership-1" }],
      platformSuperAdmin: null,
    });
    tx.platformAdministrator.upsert.mockResolvedValue({ id: "admin-1" });
    tx.platformAdministrator.findUnique.mockResolvedValue({ id: "admin-1" });
  });

  it("updates delegated permissions and records a reason in the same serializable transaction", async () => {
    await setPlatformAdministratorPermissions(
      actor,
      "staff-1",
      [PlatformPermission.DASHBOARD_READ],
      "Dashboard duty assignment",
    );

    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.platformAdministratorPermission.deleteMany).toHaveBeenCalledWith({
      where: { administratorId: "admin-1" },
    });
    expect(tx.platformAdministratorPermission.createMany).toHaveBeenCalledWith({
      data: [{
        administratorId: "admin-1",
        permission: PlatformPermission.DASHBOARD_READ,
        grantedByUserId: actor.userId,
      }],
    });
    expect(tx.platformAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: actor.userId,
        action: "PLATFORM_ADMIN_PERMISSIONS_SET",
        subjectId: "staff-1",
        outcome: "SUCCESS",
        reason: "Dashboard duty assignment",
      }),
    });
  });

  it("refuses to modify the canonical Super Administrator assignment", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "super-1",
      memberships: [{ id: "membership-1" }],
      platformSuperAdmin: { userId: "super-1" },
    });

    await expect(setPlatformAdministratorPermissions(actor, "super-1", [], "Protected account")).rejects.toThrow("CANNOT_MODIFY_SUPER_ADMIN");
    expect(tx.platformAdministratorPermission.deleteMany).not.toHaveBeenCalled();
    expect(tx.platformAuditEvent.create).not.toHaveBeenCalled();
  });

  it("revokes the platform role without deleting the user and preserves an audit record", async () => {
    await revokePlatformAdministrator(actor, "staff-1", "Access no longer required");
    expect(tx.platformAdministrator.delete).toHaveBeenCalledWith({ where: { id: "admin-1" } });
    expect(tx.platformAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: actor.userId,
        action: "PLATFORM_ADMIN_REVOKED",
        subjectId: "staff-1",
        reason: "Access no longer required",
      }),
    });
    expect(tx.user).not.toHaveProperty("delete");
  });

  it("rejects a stale Super Administrator before applying a grant", async () => {
    tx.platformSuperAdmin.findUnique.mockResolvedValue({ userId: "another-user" });
    await expect(setPlatformAdministratorPermissions(actor, "staff-1", [], "Test reason")).rejects.toThrow("SUPER_ADMIN_REQUIRED");
    expect(tx.platformAdministrator.upsert).not.toHaveBeenCalled();
  });

  it("requires dashboard access for permissions rendered only inside the dashboard", async () => {
    await expect(setPlatformAdministratorPermissions(
      actor,
      "staff-1",
      [PlatformPermission.CLIENTS_READ],
      "Read client records",
    )).rejects.toThrow("DASHBOARD_PERMISSION_REQUIRED");
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
