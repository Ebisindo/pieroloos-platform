import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformPermission } from "@prisma/client";

const {
  clientCount,
  clientFindMany,
  inquiryCount,
  inquiryFindMany,
  adminCount,
  auditFindMany,
  auditCreateMany,
  superAdminCount,
} = vi.hoisted(() => ({
  clientCount: vi.fn(),
  clientFindMany: vi.fn(),
  inquiryCount: vi.fn(),
  inquiryFindMany: vi.fn(),
  adminCount: vi.fn(),
  auditFindMany: vi.fn(),
  auditCreateMany: vi.fn(),
  superAdminCount: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: { count: clientCount, findMany: clientFindMany },
    partnershipInquiry: { count: inquiryCount, findMany: inquiryFindMany },
    platformAdministrator: { count: adminCount },
    platformAuditEvent: { findMany: auditFindMany, createMany: auditCreateMany },
    platformSuperAdmin: { count: superAdminCount },
  },
}));

import { getPlatformDashboard } from "@/lib/services/platform-admin-service";

describe("platform dashboard data scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientCount.mockResolvedValue(3);
    clientFindMany.mockResolvedValue([]);
  });

  it("scopes delegated client metrics and rows to the administrator's organizations", async () => {
    const dashboard = await getPlatformDashboard({
      userId: "admin-1",
      email: "admin@example.test",
      isSuperAdmin: false,
      permissions: [PlatformPermission.DASHBOARD_READ, PlatformPermission.CLIENTS_READ],
      organizationIds: ["org-1"],
    });

    expect(dashboard.clientCount).toBe(3);
    expect(clientCount).toHaveBeenNthCalledWith(1, {
      where: { workspace: { organizationId: { in: ["org-1"] } } },
    });
    expect(clientFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspace: { organizationId: { in: ["org-1"] } } },
    }));
    expect(auditCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        actorUserId: "admin-1",
        action: "ADMIN_CLIENT_RECORDS_READ",
        outcome: "SUCCESS",
      })],
    });
    expect(dashboard.recentInquiries).toBeNull();
    expect(inquiryFindMany).not.toHaveBeenCalled();
  });

  it("does not return client rows or inquiry detail without their explicit permissions", async () => {
    const dashboard = await getPlatformDashboard({
      userId: "admin-2",
      email: "admin2@example.test",
      isSuperAdmin: false,
      permissions: [PlatformPermission.DASHBOARD_READ],
      organizationIds: ["org-2"],
    });

    expect(dashboard.recentClients).toBeNull();
    expect(dashboard.inquiryCount).toBeNull();
    expect(dashboard.recentInquiries).toBeNull();
    expect(clientFindMany).not.toHaveBeenCalled();
    expect(inquiryCount).not.toHaveBeenCalled();
  });

  it("gives the canonical Super Admin platform-wide client scope", async () => {
    await getPlatformDashboard({
      userId: "super-1",
      email: "super@example.test",
      isSuperAdmin: true,
      permissions: [],
      organizationIds: [],
    });

    expect(clientCount).toHaveBeenNthCalledWith(1, { where: {} });
  });

  it("rejects dashboard data access when dashboard.read is missing", async () => {
    await expect(getPlatformDashboard({
      userId: "admin-3",
      email: "admin3@example.test",
      isSuperAdmin: false,
      permissions: [],
      organizationIds: ["org-3"],
    })).rejects.toThrow("PLATFORM_PERMISSION_DENIED");
    expect(clientCount).not.toHaveBeenCalled();
  });
});
