import { beforeEach, describe, expect, it, vi } from "vitest";
import { withProfessionalPartnerGrantTransaction } from "@/lib/auth/professional-partner-grant";

const { prismaTransactionMock, grantFindFirstMock, membershipFindUniqueMock, clientFindFirstMock, auditCreateMock } = vi.hoisted(() => ({
  prismaTransactionMock: vi.fn(),
  grantFindFirstMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
  clientFindFirstMock: vi.fn(),
  auditCreateMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: prismaTransactionMock } }));
vi.mock("@prisma/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/client")>();
  return { ...actual };
});

const grant = {
  id: "grant-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  clientId: "client-1",
  partnerIdentityId: "identity-1",
  capabilities: ["CLIENT_PROFILE_READ", "COMPLIANCE_READ"],
  expiresAt: new Date("2027-01-01T00:00:00.000Z"),
  partnerIdentity: { id: "identity-1", userId: "partner-user", status: "VERIFIED" },
};

describe("professional partner grant authorization", () => {
  beforeEach(() => {
    grantFindFirstMock.mockReset().mockResolvedValue(grant);
    membershipFindUniqueMock.mockReset().mockResolvedValue(null);
    clientFindFirstMock.mockReset().mockResolvedValue({ id: "client-1" });
    auditCreateMock.mockReset().mockResolvedValue({ id: "audit-1" });
    prismaTransactionMock.mockReset().mockImplementation(async (callback, options) => {
      expect(options).toMatchObject({ isolationLevel: "Serializable" });
      return callback({
        professionalPartnerGrant: { findFirst: grantFindFirstMock },
        membership: { findUnique: membershipFindUniqueMock },
        client: { findFirst: clientFindFirstMock },
        professionalPartnerGrantAuditEvent: { create: auditCreateMock },
      });
    });
  });

  it("allows a capability-matching active grant only within the granted client and records the access audit atomically", async () => {
    const result = await withProfessionalPartnerGrantTransaction({
      userId: "partner-user",
      clientId: "client-1",
      capability: "CLIENT_PROFILE_READ",
      action: "TEST_CLIENT_READ",
      resourceId: "client-1",
    }, async (_tx, scopedGrant) => {
      expect(scopedGrant.id).toBe("grant-1");
      return { clientId: "client-1" };
    });
    expect(result).toEqual({ clientId: "client-1" });
    expect(grantFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        clientId: "client-1",
        status: "ACTIVE",
        revokedAt: null,
        capabilities: { has: "CLIENT_PROFILE_READ" },
        partnerIdentity: { userId: "partner-user", status: "VERIFIED" },
      }),
    }));
    expect(clientFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "client-1", workspaceId: "workspace-1" }),
    }));
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        grantId: "grant-1",
        actorUserId: "partner-user",
        action: "TEST_CLIENT_READ",
        metadata: expect.objectContaining({ capability: "CLIENT_PROFILE_READ", resourceId: "client-1" }),
      }),
    }));
  });

  it("denies access if no unexpired, non-revoked grant has the exact required capability", async () => {
    grantFindFirstMock.mockResolvedValueOnce(null);
    await expect(withProfessionalPartnerGrantTransaction({
      userId: "partner-user", clientId: "client-1", capability: "REPORT_READ", action: "TEST_REPORT_READ",
    }, async () => "never"))
      .rejects.toThrow("PROFESSIONAL_PARTNER_ACCESS_DENIED");
    expect(clientFindFirstMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("denies access after the user becomes an organization member to prevent privilege overlap", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ id: "membership-1" });
    await expect(withProfessionalPartnerGrantTransaction({
      userId: "partner-user", clientId: "client-1", capability: "CLIENT_PROFILE_READ", action: "TEST_CLIENT_READ",
    }, async () => "never"))
      .rejects.toThrow("PROFESSIONAL_PARTNER_ACCESS_DENIED");
    expect(clientFindFirstMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("does not run resource operations when the client is outside the active grant scope", async () => {
    clientFindFirstMock.mockResolvedValueOnce(null);
    await expect(withProfessionalPartnerGrantTransaction({
      userId: "partner-user", clientId: "client-1", capability: "CLIENT_PROFILE_READ", action: "TEST_CLIENT_READ",
    }, async () => "never"))
      .rejects.toThrow("PROFESSIONAL_PARTNER_RESOURCE_NOT_FOUND");
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("does not commit an access audit if the protected operation fails", async () => {
    await expect(withProfessionalPartnerGrantTransaction({
      userId: "partner-user", clientId: "client-1", capability: "CLIENT_PROFILE_READ", action: "TEST_CLIENT_READ",
    }, async () => { throw new Error("Protected query failed"); }))
      .rejects.toThrow("Protected query failed");
    expect(auditCreateMock).not.toHaveBeenCalled();
  });
});
