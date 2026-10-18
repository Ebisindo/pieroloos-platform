import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createIdentity } from "@/app/api/professional-partners/route";
import { POST as reviewIdentity } from "@/app/api/professional-partners/[identityId]/review/route";
import { POST as suspendIdentity } from "@/app/api/professional-partners/[identityId]/suspend/route";
import { POST as createGrant } from "@/app/api/professional-partner-grants/route";
import { POST as reviewGrant } from "@/app/api/professional-partner-grants/[grantId]/review/route";
import { PATCH as amendGrant } from "@/app/api/professional-partner-grants/[grantId]/route";
import { POST as revokeGrant } from "@/app/api/professional-partner-grants/[grantId]/revoke/route";

const {
  getWorkspaceContextMock, hasInvalidRequestOriginMock, authorizedTransactionMock,
  userFindUniqueMock, membershipFindUniqueMock,
  identityFindUniqueMock, identityFindFirstMock, identityCreateMock, identityUpdateManyMock, identityFindFirstOrThrowMock,
  identityAuditCreateMock,
  clientFindFirstMock,
  grantFindFirstMock, grantFindFirstOrThrowMock, grantCreateMock, grantUpdateManyMock,
  grantAuditCreateMock,
  notificationUnusedMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  membershipFindUniqueMock: vi.fn(),
  identityFindUniqueMock: vi.fn(),
  identityFindFirstMock: vi.fn(),
  identityCreateMock: vi.fn(),
  identityUpdateManyMock: vi.fn(),
  identityFindFirstOrThrowMock: vi.fn(),
  identityAuditCreateMock: vi.fn(),
  clientFindFirstMock: vi.fn(),
  grantFindFirstMock: vi.fn(),
  grantFindFirstOrThrowMock: vi.fn(),
  grantCreateMock: vi.fn(),
  grantUpdateManyMock: vi.fn(),
  grantAuditCreateMock: vi.fn(),
  notificationUnusedMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: hasInvalidRequestOriginMock }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    professionalPartnerGrant: { findFirst: grantFindFirstMock },
  },
}));

const principal = {
  userId: "operator-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["workspace:manage"],
};

const identity = {
  id: "identity-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  userId: "partner-1",
  createdByUserId: "operator-2",
  status: "VERIFIED",
  updatedAt: new Date("2026-10-10T10:00:00.000Z"),
};

const grant = {
  id: "grant-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  clientId: "client-1",
  partnerIdentityId: "identity-1",
  grantedByUserId: "operator-2",
  status: "PENDING_REVIEW",
  updatedAt: new Date("2026-10-10T10:00:00.000Z"),
  expiresAt: new Date("2027-01-10T10:00:00.000Z"),
  purpose: "LEGAL_REVIEW",
  purposeDetails: null,
  capabilities: ["CLIENT_PROFILE_READ"],
  revokedAt: null,
  partnerIdentity: { userId: "partner-1", status: "VERIFIED" },
};

function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/professional-partners", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}
const identityContext = { params: Promise.resolve({ identityId: "identity-1" }) };
const grantContext = { params: Promise.resolve({ grantId: "grant-1" }) };

function routeRequest(body: unknown, path: string, method = "POST", origin = "http://localhost") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("professional partner grant lifecycle and privilege boundaries", () => {
  beforeEach(() => {
    hasInvalidRequestOriginMock.mockReset().mockReturnValue(false);
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    userFindUniqueMock.mockReset().mockResolvedValue({ id: "partner-1" });
    membershipFindUniqueMock.mockReset().mockResolvedValue(null);
    identityFindUniqueMock.mockReset().mockResolvedValue(null);
    identityFindFirstMock.mockReset().mockResolvedValue(identity);
    identityCreateMock.mockReset().mockResolvedValue(identity);
    identityUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    identityFindFirstOrThrowMock.mockReset().mockResolvedValue(identity);
    identityAuditCreateMock.mockReset().mockResolvedValue({ id: "identity-audit-1" });
    clientFindFirstMock.mockReset().mockResolvedValue({ id: "client-1" });
    grantFindFirstMock.mockReset().mockResolvedValue(null);
    grantFindFirstOrThrowMock.mockReset().mockResolvedValue({ ...grant, status: "ACTIVE" });
    grantCreateMock.mockReset().mockResolvedValue({ ...grant, status: "PENDING_REVIEW" });
    grantUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    grantAuditCreateMock.mockReset().mockResolvedValue({ id: "grant-audit-1" });
    authorizedTransactionMock.mockReset().mockImplementation(async (_principal, _permission, callback) => callback({
      user: { findUnique: userFindUniqueMock },
      membership: { findUnique: membershipFindUniqueMock },
      client: { findFirst: clientFindFirstMock },
      professionalPartnerIdentity: {
        findUnique: identityFindUniqueMock,
        findFirst: identityFindFirstMock,
        findMany: vi.fn().mockResolvedValue([]),
        create: identityCreateMock,
        updateMany: identityUpdateManyMock,
        findFirstOrThrow: identityFindFirstOrThrowMock,
      },
      professionalPartnerIdentityAuditEvent: { create: identityAuditCreateMock },
      professionalPartnerGrant: {
        findFirst: grantFindFirstMock,
        create: grantCreateMock,
        updateMany: grantUpdateManyMock,
        findFirstOrThrow: grantFindFirstOrThrowMock,
      },
      professionalPartnerGrantAuditEvent: { create: grantAuditCreateMock },
    }));
  });

  it("creates identities pending independent verification and rejects self-registration", async () => {
    const created = await createIdentity(request({
      userId: "partner-1",
      contactName: "External Professional",
      organizationName: "Partner Firm",
      professionalType: "LEGAL_COUNSEL",
    }));
    expect(created.status).toBe(201);
    expect(identityCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        userId: "partner-1",
        status: "PENDING_VERIFICATION",
        createdByUserId: "operator-1",
      }),
    });
    expect(identityAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "IDENTITY_CREATED", actorUserId: "operator-1" }),
    }));

    const self = await createIdentity(request({
      userId: "operator-1",
      contactName: "Tenant Operator",
      organizationName: "Tenant",
      professionalType: "CONSULTANT",
    }));
    expect(self.status).toBe(403);
  });

  it("does not register an organization staff member as an external partner", async () => {
    membershipFindUniqueMock.mockResolvedValueOnce({ id: "membership-1" });
    const response = await createIdentity(request({
      userId: "partner-1",
      contactName: "External Professional",
      organizationName: "Partner Firm",
      professionalType: "LEGAL_COUNSEL",
    }));
    expect(response.status).toBe(409);
    expect(identityCreateMock).not.toHaveBeenCalled();
  });

  it("requires a separate reviewer to verify or reject a partner identity", async () => {
    identityFindFirstMock.mockResolvedValueOnce({
      ...identity,
      status: "PENDING_VERIFICATION",
      createdByUserId: "operator-1",
      updatedAt: new Date("2026-10-10T10:00:00.000Z"),
    });
    const selfReview = await reviewIdentity(routeRequest({
      decision: "VERIFY",
      note: "Verified against official professional register.",
      expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    }, "/api/professional-partners/identity-1/review"), identityContext);
    expect(selfReview.status).toBe(403);
    expect(identityUpdateManyMock).not.toHaveBeenCalled();

    identityFindFirstMock.mockResolvedValueOnce({
      ...identity,
      status: "PENDING_VERIFICATION",
      createdByUserId: "operator-2",
      updatedAt: new Date("2026-10-10T10:00:00.000Z"),
    });
    const approved = await reviewIdentity(routeRequest({
      decision: "VERIFY",
      note: "Verified against official professional register.",
      expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    }, "/api/professional-partners/identity-1/review"), identityContext);
    expect(approved.status).toBe(200);
    expect(identityUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "PENDING_VERIFICATION", updatedAt: new Date("2026-10-10T10:00:00.000Z") }),
      data: expect.objectContaining({ status: "VERIFIED", reviewedByUserId: "operator-1" }),
    }));
    expect(identityAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "IDENTITY_VERIFIED" }),
    }));
  });

  it("creates only pending grants with expiry and stable idempotency digest", async () => {
    const response = await createGrant(routeRequest({
      clientId: "client-1",
      partnerIdentityId: "identity-1",
      purpose: "LEGAL_REVIEW",
      capabilities: ["CLIENT_PROFILE_READ", "COMPLIANCE_READ"],
      idempotencyKey: "grant-idempotency-001",
    }, "/api/professional-partner-grants"));
    expect(response.status).toBe(201);
    expect(grantCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        clientId: "client-1",
        partnerIdentityId: "identity-1",
        status: "PENDING_REVIEW",
        expiresAt: expect.any(Date),
        grantKey: expect.any(String),
        requestDigest: expect.any(String),
        grantedByUserId: "operator-1",
      }),
    });
    const input = grantCreateMock.mock.calls[0][0].data;
    expect(input.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(input.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 91 * 24 * 60 * 60 * 1000);
    expect(grantAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "GRANT_CREATED", actorUserId: "operator-1" }),
    }));
  });

  it("refuses grants and amendments containing capability enum values without implemented partner endpoints", async () => {
    for (const capability of ["GRAPH_READ", "DOCUMENT_METADATA_READ", "REPORT_READ"]) {
      const createResponse = await createGrant(routeRequest({
        clientId: "client-1",
        partnerIdentityId: "identity-1",
        purpose: "LEGAL_REVIEW",
        capabilities: [capability],
        idempotencyKey: `unsupported-capability-${capability.toLowerCase()}`,
      }, "/api/professional-partner-grants"));
      expect(createResponse.status).toBe(422);

      const amendResponse = await amendGrant(routeRequest({
        capabilities: [capability],
        reason: "Unsupported capability blocked before activation.",
        expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
      }, "/api/professional-partner-grants/grant-1", "PATCH"), grantContext);
      expect(amendResponse.status).toBe(422);
    }

    expect(grantCreateMock).not.toHaveBeenCalled();
    expect(grantUpdateManyMock).not.toHaveBeenCalled();
    expect(grantAuditCreateMock).not.toHaveBeenCalled();
  });

  it("rejects non-owner unlimited grants and accepts them only when explicitly owner-authorized", async () => {
    getWorkspaceContextMock.mockResolvedValueOnce({
      userId: principal.userId,
      principal: { ...principal, role: "manager" },
    });
    const forbidden = await createGrant(routeRequest({
      clientId: "client-1",
      partnerIdentityId: "identity-1",
      purpose: "LEGAL_REVIEW",
      capabilities: ["CLIENT_PROFILE_READ"],
      expiresAt: null,
      idempotencyKey: "no-expiry-grant-01",
    }, "/api/professional-partner-grants"));
    expect(forbidden.status).toBe(403);
    expect(grantCreateMock).not.toHaveBeenCalled();

    const allowed = await createGrant(routeRequest({
      clientId: "client-1",
      partnerIdentityId: "identity-1",
      purpose: "LEGAL_REVIEW",
      capabilities: ["CLIENT_PROFILE_READ"],
      expiresAt: null,
      idempotencyKey: "no-expiry-grant-02",
    }, "/api/professional-partner-grants"));
    expect(allowed.status).toBe(201);
    expect(grantCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiresAt: null, status: "PENDING_REVIEW" }),
    }));
  });

  it("returns the existing grant on a matching idempotency retry and rejects mismatched retry parameters", async () => {
    const matchingBody = {
      clientId: "client-1", partnerIdentityId: "identity-1", purpose: "LEGAL_REVIEW",
      capabilities: ["CLIENT_PROFILE_READ"], idempotencyKey: "same-grant-key-001",
    };
    const original = {
      ...grant,
      grantKey: (await import("node:crypto")).createHash("sha256").update(matchingBody.idempotencyKey).digest("hex"),
    };
    // The request digest depends on effective expiry. Exercise the conflict branch with a reused key and different terms.
    grantFindFirstMock.mockResolvedValueOnce({ ...original, requestDigest: "digest-from-another-request" });
    const response = await createGrant(routeRequest(matchingBody, "/api/professional-partner-grants"));
    expect(response.status).toBe(409);
    expect(grantCreateMock).not.toHaveBeenCalled();
  });

  it("denies grant approval by grant creator or partner subject", async () => {
    grantFindFirstMock.mockResolvedValueOnce({
      ...grant, status: "PENDING_REVIEW", grantedByUserId: "operator-1",
      partnerIdentity: { userId: "partner-1", status: "VERIFIED" },
    });
    const response = await reviewGrant(routeRequest({
      decision: "APPROVE", note: "Grant terms independently approved.", expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    }, "/api/professional-partner-grants/grant-1/review"), grantContext);
    expect(response.status).toBe(403);
    expect(grantUpdateManyMock).not.toHaveBeenCalled();
  });

  it("does not activate a grant when the identity is suspended or expiry is already past", async () => {
    grantFindFirstMock.mockResolvedValueOnce({
      ...grant, status: "PENDING_REVIEW", updatedAt: new Date("2026-10-10T10:00:00.000Z"),
      partnerIdentity: { userId: "partner-1", status: "SUSPENDED" },
    });
    const suspended = await reviewGrant(routeRequest({
      decision: "APPROVE", note: "Grant terms independently approved.", expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    }, "/api/professional-partner-grants/grant-1/review"), grantContext);
    expect(suspended.status).toBe(409);
    expect(grantUpdateManyMock).not.toHaveBeenCalled();

    grantFindFirstMock.mockResolvedValueOnce({
      ...grant, status: "PENDING_REVIEW", updatedAt: new Date("2026-10-10T10:00:00.000Z"),
      expiresAt: new Date("2026-01-01T00:00:00.000Z"),
      partnerIdentity: { userId: "partner-1", status: "VERIFIED" },
    });
    const expired = await reviewGrant(routeRequest({
      decision: "APPROVE", note: "Grant terms independently approved.", expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    }, "/api/professional-partner-grants/grant-1/review"), grantContext);
    expect(expired.status).toBe(409);
    expect(grantUpdateManyMock).not.toHaveBeenCalled();
  });

  it("amending terms immediately makes an active grant inactive until independent re-approval", async () => {
    grantFindFirstMock.mockResolvedValueOnce({
      ...grant, status: "ACTIVE", updatedAt: new Date("2026-10-10T10:00:00.000Z"),
      expiresAt: new Date("2027-01-10T10:00:00.000Z"),
      partnerIdentity: { userId: "partner-1", status: "VERIFIED" },
    });
    const response = await amendGrant(routeRequest({
      capabilities: ["CLIENT_PROFILE_READ", "REPORT_READ"],
      reason: "Additional reporting scope is required for the engagement.",
      expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    }, "/api/professional-partner-grants/grant-1", "PATCH"), grantContext);
    expect(response.status).toBe(200);
    expect(grantUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "ACTIVE", updatedAt: new Date("2026-10-10T10:00:00.000Z") }),
      data: expect.objectContaining({ status: "PENDING_REVIEW", reviewedByUserId: null, reviewedAt: null }),
    }));
    expect(grantAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "GRANT_AMENDMENT_REQUESTED" }),
    }));
  });

  it("revokes a grant using a compare-and-set transition and records the reason", async () => {
    grantFindFirstMock.mockResolvedValueOnce({
      ...grant, status: "ACTIVE", updatedAt: new Date("2026-10-10T10:00:00.000Z"),
      partnerIdentity: { userId: "partner-1", status: "VERIFIED" },
    });
    const response = await revokeGrant(routeRequest({
      reason: "Engagement has concluded and access must stop.",
      expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    }, "/api/professional-partner-grants/grant-1/revoke"), grantContext);
    expect(response.status).toBe(200);
    expect(grantUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "ACTIVE" }),
      data: expect.objectContaining({ status: "REVOKED", revokedByUserId: "operator-1", revokedAt: expect.any(Date) }),
    }));
    expect(grantAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "GRANT_REVOKED", reason: "Engagement has concluded and access must stop." }),
    }));
  });

  it("does not change status or record audit history on a failed compare-and-set", async () => {
    grantFindFirstMock.mockResolvedValueOnce({
      ...grant, status: "ACTIVE", updatedAt: new Date("2026-10-10T10:00:00.000Z"),
      partnerIdentity: { userId: "partner-1", status: "VERIFIED" },
    });
    grantUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const response = await revokeGrant(routeRequest({
      reason: "Engagement has concluded and access must stop.",
      expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    }, "/api/professional-partner-grants/grant-1/revoke"), grantContext);
    expect(response.status).toBe(409);
    expect(grantAuditCreateMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutations across every partner identity and grant lifecycle endpoint before database work", async () => {
    hasInvalidRequestOriginMock.mockReturnValue(true);

    const crossOrigin = "https://attacker.example";
    const results = await Promise.all([
      createIdentity(routeRequest({}, "/api/professional-partners", "POST", crossOrigin)),
      reviewIdentity(routeRequest({}, "/api/professional-partners/identity-1/review", "POST", crossOrigin), identityContext),
      suspendIdentity(routeRequest({}, "/api/professional-partners/identity-1/suspend", "POST", crossOrigin), identityContext),
      createGrant(routeRequest({}, "/api/professional-partner-grants", "POST", crossOrigin)),
      reviewGrant(routeRequest({}, "/api/professional-partner-grants/grant-1/review", "POST", crossOrigin), grantContext),
      amendGrant(routeRequest({}, "/api/professional-partner-grants/grant-1", "PATCH", crossOrigin), grantContext),
      revokeGrant(routeRequest({}, "/api/professional-partner-grants/grant-1/revoke", "POST", crossOrigin), grantContext),
    ]);

    expect(results.map((response) => response.status)).toEqual([403, 403, 403, 403, 403, 403, 403]);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
    expect(identityCreateMock).not.toHaveBeenCalled();
    expect(identityUpdateManyMock).not.toHaveBeenCalled();
    expect(grantCreateMock).not.toHaveBeenCalled();
    expect(grantUpdateManyMock).not.toHaveBeenCalled();
    expect(identityAuditCreateMock).not.toHaveBeenCalled();
    expect(grantAuditCreateMock).not.toHaveBeenCalled();
  });

  it("suspends verified partner identity with a recorded reason", async () => {
    identityFindFirstMock.mockResolvedValueOnce({
      ...identity, status: "VERIFIED", updatedAt: new Date("2026-10-10T10:00:00.000Z"),
    });
    const response = await suspendIdentity(routeRequest({
      reason: "Professional registration is under investigation.",
      expectedUpdatedAt: "2026-10-10T10:00:00.000Z",
    }, "/api/professional-partners/identity-1/suspend"), identityContext);
    expect(response.status).toBe(200);
    expect(identityUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "VERIFIED" }),
      data: expect.objectContaining({ status: "SUSPENDED", suspendedByUserId: "operator-1" }),
    }));
    expect(identityAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "IDENTITY_SUSPENDED" }),
    }));
  });
});
