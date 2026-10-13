import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformPermission } from "@prisma/client";

const { actorMock, auditMock, setPermissionsMock, revokeMock, listMock } = vi.hoisted(() => ({
  actorMock: vi.fn(),
  auditMock: vi.fn(),
  setPermissionsMock: vi.fn(),
  revokeMock: vi.fn(),
  listMock: vi.fn(),
}));

vi.mock("@/lib/auth/platform-access", () => ({ getCurrentPlatformActor: actorMock }));
vi.mock("@/lib/services/platform-admin-service", () => ({
  listPlatformAdministrators: listMock,
  recordPlatformAuditEvent: auditMock,
  setPlatformAdministratorPermissions: setPermissionsMock,
  revokePlatformAdministrator: revokeMock,
}));

import { DELETE, GET, PATCH, POST } from "@/app/api/admin/administrators/route";

const superAdmin = {
  userId: "super-1",
  email: "super@example.test",
  isSuperAdmin: true,
  permissions: [],
  organizationIds: [],
};
const ordinaryAdmin = {
  userId: "admin-1",
  email: "admin@example.test",
  isSuperAdmin: false,
  permissions: [PlatformPermission.ADMINS_READ],
  organizationIds: [],
};

function request(method: string, body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/admin/administrators", {
    method,
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("administrator management API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication to read administrator assignments", async () => {
    actorMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("allows an ordinary administrator to read only when assigned admins.read", async () => {
    actorMock.mockResolvedValue(ordinaryAdmin);
    listMock.mockResolvedValue({ administrators: [], eligibleUsers: null });
    expect((await GET()).status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(ordinaryAdmin);
  });

  it("rejects client-supplied Super Admin claims from ordinary administrators", async () => {
    actorMock.mockResolvedValue(ordinaryAdmin);
    const response = await POST(request("POST", {
      userId: "staff-2",
      permissions: [PlatformPermission.DASHBOARD_READ],
      reason: "Requested dashboard access",
      isSuperAdmin: true,
      role: "SUPER_ADMIN",
    }));
    expect(response.status).toBe(403);
    expect(setPermissionsMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: ordinaryAdmin.userId,
      action: "PLATFORM_ADMIN_GRANT_DENIED",
      outcome: "DENIED",
    }));
  });

  it("rejects cross-origin writes before changing administrator assignments", async () => {
    actorMock.mockResolvedValue(superAdmin);
    expect((await PATCH(request("PATCH", {
      userId: "staff-2",
      permissions: [],
      reason: "Remove all assigned access",
    }, "https://evil.example"))).status).toBe(403);
    expect(setPermissionsMock).not.toHaveBeenCalled();
  });

  it("validates permission identifiers and requires a decision reason", async () => {
    actorMock.mockResolvedValue(superAdmin);
    expect((await POST(request("POST", {
      userId: "staff-2",
      permissions: ["SUPER_ADMIN"],
      reason: "Grant elevated access",
    }))).status).toBe(422);
    expect((await POST(request("POST", {
      userId: "staff-2",
      permissions: [PlatformPermission.DASHBOARD_READ],
      reason: "short",
    }))).status).toBe(422);
    expect(setPermissionsMock).not.toHaveBeenCalled();
  });

  it("requires dashboard.read when assigning permissions shown only on the dashboard", async () => {
    actorMock.mockResolvedValue(superAdmin);
    setPermissionsMock.mockRejectedValue(new Error("DASHBOARD_PERMISSION_REQUIRED"));
    const response = await POST(request("POST", {
      userId: "staff-2",
      permissions: [PlatformPermission.CLIENTS_READ],
      reason: "Client records access",
    }));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("Dashboard access is required");
  });

  it("lets the database-backed Super Admin grant validated explicit permissions", async () => {
    actorMock.mockResolvedValue(superAdmin);
    setPermissionsMock.mockResolvedValue({ id: "assignment-1" });
    const response = await POST(request("POST", {
      userId: "staff-2",
      permissions: [PlatformPermission.DASHBOARD_READ],
      reason: "Dashboard reporting duties",
    }));
    expect(response.status).toBe(201);
    expect(setPermissionsMock).toHaveBeenCalledWith(
      superAdmin,
      "staff-2",
      [PlatformPermission.DASHBOARD_READ],
      "Dashboard reporting duties",
    );
  });

  it("lets the Super Admin revoke an ordinary platform role with a reason", async () => {
    actorMock.mockResolvedValue(superAdmin);
    revokeMock.mockResolvedValue(undefined);
    const response = await DELETE(request("DELETE", {
      userId: "staff-2",
      reason: "Access no longer required",
    }));
    expect(response.status).toBe(200);
    expect(revokeMock).toHaveBeenCalledWith(superAdmin, "staff-2", "Access no longer required");
  });
});
