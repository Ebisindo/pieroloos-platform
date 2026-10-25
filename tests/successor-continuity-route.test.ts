import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  actorMock, listMock, addMock, aliveMock, assetMock, revokeMock, runbookMock, simulateMock,
  rateLimitMock, prismaMock,
} = vi.hoisted(() => ({
  actorMock: vi.fn(), listMock: vi.fn(), addMock: vi.fn(), aliveMock: vi.fn(),
  assetMock: vi.fn(), revokeMock: vi.fn(), runbookMock: vi.fn(), simulateMock: vi.fn(),
  rateLimitMock: vi.fn(),
  prismaMock: {
    membership: { findFirst: vi.fn() },
    complianceNotification: { create: vi.fn() },
    successor: { update: vi.fn() },
    platformAuditEvent: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth/platform-access", () => ({ getCurrentPlatformActor: actorMock }));
vi.mock("@/lib/http/rate-limit", () => ({ enforceRateLimit: rateLimitMock, PLATFORM_ADMIN_MUTATION_LIMIT: { name: "test", limit: 10, windowMs: 60000 } }));
vi.mock("@/lib/services/successor-continuity-service", () => ({
  addSuccessor: addMock, confirmOwnerAlive: aliveMock, createContinuityAsset: assetMock,
  listSuccessors: listMock, revokeSuccessor: revokeMock, saveRunbook: runbookMock, simulateHandover: simulateMock,
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
import { GET, POST } from "@/app/api/admin/successors/route";

const superAdmin = { userId: "owner-1", email: "owner@example.test", isSuperAdmin: true, permissions: [], organizationIds: ["org-1"] };
const ordinaryAdmin = { userId: "admin-1", email: "admin@example.test", isSuperAdmin: false, permissions: [], organizationIds: ["org-1"] };
const oldStepUp = process.env.CONTINUITY_STEP_UP_ENFORCED;
const oldSiteUrl = process.env.SITE_URL;
const oldNextAuthUrl = process.env.NEXTAUTH_URL;
function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/admin/successors", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("successor management route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONTINUITY_STEP_UP_ENFORCED;
    process.env.SITE_URL = "http://localhost";
    rateLimitMock.mockResolvedValue(null);
    prismaMock.membership.findFirst.mockResolvedValue({
      organizationId: "org-1",
      organization: { workspaces: [{ id: "workspace-1" }] },
    });
    prismaMock.complianceNotification.create.mockResolvedValue({ id: "notification-1" });
    prismaMock.successor.update.mockResolvedValue({});
    prismaMock.platformAuditEvent.create.mockResolvedValue({});
  });
  afterEach(() => {
    if (oldStepUp === undefined) delete process.env.CONTINUITY_STEP_UP_ENFORCED; else process.env.CONTINUITY_STEP_UP_ENFORCED = oldStepUp;
    if (oldSiteUrl === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = oldSiteUrl;
    if (oldNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = oldNextAuthUrl;
  });

  it("requires authenticated SuperAdmin access to list successors", async () => {
    actorMock.mockResolvedValue(null);
    const anonymousResponse = await GET();
    expect(anonymousResponse.status).toBe(401);
    actorMock.mockResolvedValue(ordinaryAdmin);
    const ordinaryResponse = await GET();
    expect(ordinaryResponse.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("fails closed on writes until a trusted MFA step-up signal is implemented", async () => {
    actorMock.mockResolvedValue(superAdmin);
    const response = await POST(request({
      successorName: "Continuity Contact", successorEmail: "successor@example.test", relationship: "CTO",
      autoActivateAfterDays: 60,
      permissions: { canTransferOwnership: false, canAccessSecrets: false, canDeploy: true, canAccessBilling: false },
    }));
    expect(response!.status).toBe(503);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutations before any service call", async () => {
    actorMock.mockResolvedValue(superAdmin);
    const response = await POST(request({
      successorName: "Continuity Contact", successorEmail: "successor@example.test", relationship: "CTO",
      autoActivateAfterDays: 60,
      permissions: { canTransferOwnership: false, canAccessSecrets: false, canDeploy: true, canAccessBilling: false },
    }, "https://evil.example"));
    expect(response!.status).toBe(403);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported inactivity threshold and undeclared permission keys", async () => {
    actorMock.mockResolvedValue(superAdmin);
    const response = await POST(request({
      successorName: "Continuity Contact", successorEmail: "successor@example.test", relationship: "CTO",
      autoActivateAfterDays: 45,
      permissions: { canTransferOwnership: false, canAccessSecrets: false, canDeploy: true, canAccessBilling: false, isSuperAdmin: true },
    }));
    expect(response!.status).toBe(422);
    expect(addMock).not.toHaveBeenCalled();
  });
});
