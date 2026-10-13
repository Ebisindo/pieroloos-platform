import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformPermission } from "@prisma/client";

const { authMock, userFindUnique } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: userFindUnique } },
}));

import { getCurrentPlatformActor, hasPlatformPermission } from "@/lib/auth/platform-access";

describe("platform authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies an anonymous request without consulting role data", async () => {
    authMock.mockResolvedValue(null);
    expect(await getCurrentPlatformActor()).toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("loads ordinary administrator permissions and organization scope from the database", async () => {
    authMock.mockResolvedValue({ user: { id: "staff-1", email: "staff@example.test" } });
    userFindUnique.mockResolvedValue({
      platformSuperAdmin: null,
      platformAdministrator: { permissions: [{ permission: PlatformPermission.CLIENTS_READ }] },
      memberships: [{ organizationId: "org-1" }],
    });

    const actor = await getCurrentPlatformActor();
    expect(actor).toMatchObject({
      userId: "staff-1",
      isSuperAdmin: false,
      permissions: [PlatformPermission.CLIENTS_READ],
      organizationIds: ["org-1"],
    });
    expect(userFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "staff-1" },
      select: expect.objectContaining({
        platformSuperAdmin: { select: { userId: true } },
      }),
    }));
    expect(actor && hasPlatformPermission(actor, PlatformPermission.CLIENTS_READ)).toBe(true);
    expect(actor && hasPlatformPermission(actor, PlatformPermission.AUDIT_READ)).toBe(false);
  });

  it("grants Super Admin authority only from the persisted singleton assignment", async () => {
    authMock.mockResolvedValue({
      user: { id: "staff-2", email: "staff2@example.test", isSuperAdmin: false },
    });
    userFindUnique.mockResolvedValue({
      platformSuperAdmin: { userId: "staff-2" },
      platformAdministrator: null,
      memberships: [{ organizationId: "org-2" }],
    });

    const actor = await getCurrentPlatformActor();
    expect(actor?.isSuperAdmin).toBe(true);
    expect(actor && hasPlatformPermission(actor, PlatformPermission.AUDIT_READ)).toBe(true);
  });

  it("does not trust a session Super Admin claim when the database has no assignment", async () => {
    authMock.mockResolvedValue({
      user: { id: "staff-3", email: "staff3@example.test", isSuperAdmin: true },
    });
    userFindUnique.mockResolvedValue({
      platformSuperAdmin: null,
      platformAdministrator: null,
      memberships: [{ organizationId: "org-3" }],
    });

    expect((await getCurrentPlatformActor())?.isSuperAdmin).toBe(false);
  });

  it("does not grant platform access to a portal-only account without staff membership", async () => {
    authMock.mockResolvedValue({ user: { id: "portal-1", email: "portal@example.test" } });
    userFindUnique.mockResolvedValue({
      platformSuperAdmin: { userId: "portal-1" },
      platformAdministrator: null,
      memberships: [],
    });

    expect(await getCurrentPlatformActor()).toBeNull();
  });
});
