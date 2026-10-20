import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/business-intent/proposals/[id]/execution-authorizations/route";

const {
  getWorkspaceContextMock,
  hasInvalidRequestOriginMock,
  authorizedTransactionMock,
  proposalFindFirstMock,
  authorizationFindUniqueMock,
  authorizationCreateMock,
  activityCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  proposalFindFirstMock: vi.fn(),
  authorizationFindUniqueMock: vi.fn(),
  authorizationCreateMock: vi.fn(),
  activityCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: hasInvalidRequestOriginMock }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));

const principal = {
  userId: "approver-2",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "advisor",
  permissions: ["formation:write"],
};
const routeContext = { params: Promise.resolve({ id: "proposal-1" }) };
const validBody = (overrides: Record<string, unknown> = {}) => ({
  expectedVersion: 4,
  idempotencyKey: "intent-auth-0001",
  confirmExactOperation: true,
  operationType: "PAYMENT",
  operation: {
    currency: "NGN",
    amountMinor: "125000",
    recipientReference: "vendor-reference-7",
    purpose: "Approved incorporation service fee",
    environment: "SANDBOX",
  },
  ...overrides,
});

function request(body: unknown) {
  return new Request("http://localhost/api/ai/business-intent/proposals/proposal-1/execution-authorizations", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("separate AI execution authorization", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    hasInvalidRequestOriginMock.mockReset().mockReturnValue(false);
    proposalFindFirstMock.mockReset().mockResolvedValue({
      id: "proposal-1",
      clientId: null,
      createdByUserId: "proposal-creator",
      reviewedByUserId: "independent-reviewer",
      status: "APPROVED",
      version: 4,
    });
    authorizationFindUniqueMock.mockReset().mockResolvedValue(null);
    authorizationCreateMock.mockReset().mockImplementation(async ({ data }) => ({
      id: "authorization-1",
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    authorizedTransactionMock.mockReset().mockImplementation(async (_principal, _permission, callback) => callback({
      businessIntentProposal: { findFirst: proposalFindFirstMock },
      aiExecutionAuthorization: {
        findUnique: authorizationFindUniqueMock,
        create: authorizationCreateMock,
      },
      activity: { create: activityCreateMock },
    }));
  });

  it("requires explicit confirmation and rejects unknown request fields", async () => {
    const response = await POST(request(validBody({ confirmExactOperation: false, bypassApproval: true })), routeContext);
    expect(response.status).toBe(422);
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("refuses consent for a proposal that is not approved", async () => {
    proposalFindFirstMock.mockResolvedValueOnce({
      id: "proposal-1", status: "PROPOSED", version: 4,
      createdByUserId: "proposal-creator", reviewedByUserId: null,
    });
    const response = await POST(request(validBody()), routeContext);
    expect(response.status).toBe(409);
    expect(authorizationCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("requires independent review and the exact current approved version", async () => {
    proposalFindFirstMock.mockResolvedValueOnce({
      id: "proposal-1", status: "APPROVED", version: 5,
      createdByUserId: "proposal-creator", reviewedByUserId: "independent-reviewer",
    });
    const stale = await POST(request(validBody({ expectedVersion: 4 })), routeContext);
    expect(stale.status).toBe(409);
    expect(authorizationCreateMock).not.toHaveBeenCalled();

    proposalFindFirstMock.mockResolvedValueOnce({
      id: "proposal-1", status: "APPROVED", version: 4,
      createdByUserId: "same-person", reviewedByUserId: "same-person",
    });
    const selfReviewed = await POST(request(validBody()), routeContext);
    expect(selfReviewed.status).toBe(409);
    expect(authorizationCreateMock).not.toHaveBeenCalled();
  });

  it("records a time-limited operation digest and explicitly reports no execution", async () => {
    const response = await POST(request(validBody()), routeContext);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.executionPerformed).toBe(false);
    expect(body.data.status).toBe("AUTHORIZED");
    expect(body.data.operationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(authorizationCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        proposalId: "proposal-1",
        proposalVersion: 4,
        operationType: "PAYMENT",
        operationDigest: body.data.operationDigest,
        idempotencyKey: "intent-auth-0001",
        authorizedByUserId: principal.userId,
        status: "AUTHORIZED",
      }),
    });
    expect(activityCreateMock).toHaveBeenCalledTimes(1);
  });

  it("returns the existing authorization for an identical idempotent retry", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const existing = {
      id: "authorization-existing",
      proposalId: "proposal-1",
      proposalVersion: 4,
      operationType: "PAYMENT",
      operationDigest: "0".repeat(64),
      idempotencyKey: "intent-auth-0001",
      status: "AUTHORIZED",
      expiresAt,
      authorizedAt: new Date(),
    };
    authorizationFindUniqueMock.mockResolvedValueOnce(existing);
    // Use a digest that matches the validated request.
    const { digestExecutionOperation } = await import("@/lib/domain/execution-authorization");
    existing.operationDigest = digestExecutionOperation("PAYMENT", validBody().operation as never);
    const response = await POST(request(validBody()), routeContext);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.replay).toBe(true);
    expect(body.data.executionPerformed).toBe(false);
    expect(authorizationCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key reused for a different operation", async () => {
    authorizationFindUniqueMock.mockResolvedValueOnce({
      id: "authorization-existing",
      proposalId: "proposal-1",
      proposalVersion: 4,
      operationType: "PAYMENT",
      operationDigest: "f".repeat(64),
      idempotencyKey: "intent-auth-0001",
      status: "AUTHORIZED",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const response = await POST(request(validBody()), routeContext);
    expect(response.status).toBe(409);
    expect(authorizationCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });
});
