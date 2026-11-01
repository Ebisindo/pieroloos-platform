import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  actorMock, authMock, listMock, addMock, aliveMock, assetMock, revokeMock, runbookMock, simulateMock,
  rateLimitMock, consumeMock, prismaMock, txMock, FirebaseStepUpErrorMock,
} = vi.hoisted(() => {
  class TestFirebaseStepUpError extends Error {
    constructor(public code: string) { super(code); this.name = "FirebaseStepUpError"; }
  }
  return {
    actorMock: vi.fn(), authMock: vi.fn(), listMock: vi.fn(), addMock: vi.fn(), aliveMock: vi.fn(),
    assetMock: vi.fn(), revokeMock: vi.fn(), runbookMock: vi.fn(), simulateMock: vi.fn(),
    rateLimitMock: vi.fn(), consumeMock: vi.fn(),
    FirebaseStepUpErrorMock: TestFirebaseStepUpError,
    txMock: {
      complianceNotification: { create: vi.fn() },
      firebaseStepUpChallenge: { updateMany: vi.fn() },
    },
    prismaMock: {
      membership: { findFirst: vi.fn() },
      complianceNotification: { create: vi.fn() },
      successor: { update: vi.fn() },
      platformAuditEvent: { create: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/auth/platform-access", () => ({ getCurrentPlatformActor: actorMock }));
vi.mock("@/lib/auth/auth", () => ({ auth: authMock }));
vi.mock("@/lib/http/rate-limit", () => ({ enforceRateLimit: rateLimitMock, PLATFORM_ADMIN_MUTATION_LIMIT: { name: "test", limit: 10, windowMs: 60000 } }));
vi.mock("@/lib/auth/firebase-step-up", () => ({ FirebaseStepUpError: FirebaseStepUpErrorMock }));
vi.mock("@/lib/services/firebase-step-up-service", () => ({ consumeFirebaseStepUpChallenge: consumeMock }));
vi.mock("@/lib/services/successor-continuity-service", () => ({
  addSuccessor: addMock, confirmOwnerAlive: aliveMock, createContinuityAsset: assetMock,
  listSuccessors: listMock, revokeSuccessor: revokeMock, saveRunbook: runbookMock, simulateHandover: simulateMock,
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
import { GET, PATCH, POST } from "@/app/api/admin/successors/route";

const superAdmin = { userId: "owner-1", email: "owner@example.test", isSuperAdmin: true, permissions: [], organizationIds: ["org-1"] };
const ordinaryAdmin = { userId: "admin-1", email: "admin@example.test", isSuperAdmin: false, permissions: [], organizationIds: ["org-1"] };
const sessionId = "server-issued-step-up-session-id";
const stepUpHandle = "a".repeat(43);
const oldSiteUrl = process.env.SITE_URL;
const oldNextAuthUrl = process.env.NEXTAUTH_URL;
function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/admin/successors", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
function patchRequest(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/admin/successors", {
    method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
const createPayload = (stepUp = stepUpHandle) => ({
  successorName: "Continuity Contact", successorEmail: "successor@example.test", relationship: "CTO",
  autoActivateAfterDays: 60,
  permissions: { canTransferOwnership: false, canAccessSecrets: false, canDeploy: true, canAccessBilling: false },
  ...(stepUp ? { stepUpHandle: stepUp } : {}),
});

describe("successor management route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SITE_URL = "http://localhost";
    rateLimitMock.mockResolvedValue(null);
    actorMock.mockResolvedValue(superAdmin);
    authMock.mockResolvedValue({ user: { id: superAdmin.userId }, stepUpSessionId: sessionId });
    consumeMock.mockResolvedValue({ consumedAt: new Date() });
    prismaMock.membership.findFirst.mockResolvedValue({
      organizationId: "org-1",
      organization: { workspaces: [{ id: "workspace-1" }] },
    });
    prismaMock.complianceNotification.create.mockResolvedValue({ id: "notification-1" });
    prismaMock.successor.update.mockResolvedValue({});
    prismaMock.platformAuditEvent.create.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (work) => work(txMock));
    txMock.complianceNotification.create.mockResolvedValue({ id: "notification-1" });
    addMock.mockResolvedValue({
      successor: { id: "successor-1", successorName: "Continuity Contact", successorEmail: "successor@example.test" },
      token: "test-one-time-invitation-token",
    });
    aliveMock.mockResolvedValue({ resetAt: "2026-10-26T14:00:00.000Z", successorRecordsReset: 1 });
    listMock.mockResolvedValue({ successors: [], assets: [], runbooks: [] });
  });
  afterEach(() => {
    if (oldSiteUrl === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = oldSiteUrl;
    if (oldNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = oldNextAuthUrl;
  });

  it("requires authenticated SuperAdmin access to list successors", async () => {
    actorMock.mockResolvedValue(null);
    expect((await GET())!.status).toBe(401);
    actorMock.mockResolvedValue(ordinaryAdmin);
    expect((await GET())!.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("fails closed when POST has no verified step-up handle", async () => {
    const response = await POST(request(createPayload("")));
    expect(response!.status).toBe(401);
    expect(addMock).not.toHaveBeenCalled();
    expect(consumeMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.complianceNotification.create).not.toHaveBeenCalled();
  });

  it("fails closed for every PATCH action without any continuity or database side effect", async () => {
    const actions = [
      { action: "alive" },
      { action: "simulate", successorId: "successor-1" },
      { action: "revoke", successorId: "successor-1", reason: "Revocation requested by owner" },
      { action: "asset", asset: { assetType: "domain", label: "Primary domain", recoveryLocation: "Registrar account reference", criticality: "HIGH" } },
      { action: "runbook", runbook: { title: "Recovery procedure", content: "Documented recovery steps for the authorized reviewer." } },
    ];
    for (const action of actions) {
      const response = await PATCH(patchRequest(action));
      expect(response!.status, action.action).toBe(401);
    }
    expect(aliveMock).not.toHaveBeenCalled();
    expect(simulateMock).not.toHaveBeenCalled();
    expect(revokeMock).not.toHaveBeenCalled();
    expect(assetMock).not.toHaveBeenCalled();
    expect(runbookMock).not.toHaveBeenCalled();
    expect(consumeMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.complianceNotification.create).not.toHaveBeenCalled();
    expect(prismaMock.successor.update).not.toHaveBeenCalled();
    expect(prismaMock.platformAuditEvent.create).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutations before challenge consumption", async () => {
    const response = await POST(request(createPayload(), "https://evil.example"));
    expect(response!.status).toBe(403);
    expect(consumeMock).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
  });

  it("consumes create-successor step-up in the same transaction as the domain write and notification queue", async () => {
    const response = await POST(request(createPayload()));
    expect(response!.status).toBe(201);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(consumeMock).toHaveBeenCalledWith(txMock, {
      userId: superAdmin.userId, sessionId, operation: "continuity:create-successor", handle: stepUpHandle,
    });
    expect(addMock).toHaveBeenCalledWith(superAdmin, expect.objectContaining({ successorName: "Continuity Contact" }), txMock);
    expect(txMock.complianceNotification.create).toHaveBeenCalledOnce();
  });

  it("rolls back before domain service calls when step-up consumption fails", async () => {
    consumeMock.mockRejectedValue(new FirebaseStepUpErrorMock("INVALID_CHALLENGE"));
    const response = await POST(request(createPayload()));
    expect(response!.status).toBe(401);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(addMock).not.toHaveBeenCalled();
    expect(txMock.complianceNotification.create).not.toHaveBeenCalled();
  });

  it("consumes the matching owner-alive operation in the same transaction as its audit/mutation", async () => {
    const response = await PATCH(patchRequest({ action: "alive", stepUpHandle }));
    expect(response!.status).toBe(200);
    expect(consumeMock).toHaveBeenCalledWith(txMock, {
      userId: superAdmin.userId, sessionId, operation: "continuity:owner-alive", handle: stepUpHandle,
    });
    expect(aliveMock).toHaveBeenCalledWith(superAdmin, txMock);
  });

  it("does not process requested permissions until a valid step-up handle is supplied", async () => {
    const response = await POST(request({
      ...createPayload(),
      autoActivateAfterDays: 45,
      permissions: { canTransferOwnership: false, canAccessSecrets: false, canDeploy: true, canAccessBilling: false, isSuperAdmin: true },
    }));
    expect(response!.status).toBe(422);
    expect(addMock).not.toHaveBeenCalled();
    expect(consumeMock).not.toHaveBeenCalled();
  });
});
