import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/business-intent/proposals/[id]/execution-authorizations/[authorizationId]/revoke/route";

const {
  getWorkspaceContextMock,
  hasInvalidRequestOriginMock,
  authorizedTransactionMock,
  authorizationFindFirstMock,
  authorizationUpdateManyMock,
  activityCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  authorizationFindFirstMock: vi.fn(),
  authorizationUpdateManyMock: vi.fn(),
  activityCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: hasInvalidRequestOriginMock }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));

const principal = {
  userId: "owner-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["formation:write"],
};
const routeContext = { params: Promise.resolve({ id: "proposal-1", authorizationId: "authorization-1" }) };

function request() {
  return new Request("http://localhost/api/ai/business-intent/proposals/proposal-1/execution-authorizations/authorization-1/revoke", {
    method: "POST",
    headers: { origin: "http://localhost" },
  });
}

describe("execution authorization revocation expiry race", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    hasInvalidRequestOriginMock.mockReset().mockReturnValue(false);
    authorizationFindFirstMock.mockReset().mockResolvedValue({
      id: "authorization-1",
      proposalId: "proposal-1",
      proposalVersion: 4,
      operationType: "PAYMENT",
      operationDigest: "a".repeat(64),
      status: "AUTHORIZED",
      authorizedByUserId: "advisor-1",
      expiresAt: new Date(Date.now() - 1_000),
    });
    authorizationUpdateManyMock.mockReset().mockResolvedValue({ count: 0 });
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    authorizedTransactionMock.mockReset().mockImplementation(async (_principal, _permission, callback) => callback({
      aIExecutionAuthorization: {
        findFirst: authorizationFindFirstMock,
        updateMany: authorizationUpdateManyMock,
      },
      activity: { create: activityCreateMock },
    }));
  });

  it("returns a conflict rather than claiming expiry when the conditional state update loses a race", async () => {
    const response = await POST(request(), routeContext);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/concurrently/i);
    expect(authorizationUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "authorization-1",
        status: "AUTHORIZED",
        expiresAt: expect.objectContaining({ lte: expect.any(Date) }),
      }),
      data: { status: "EXPIRED" },
    }));
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("records expiry only after the conditional update succeeds", async () => {
    authorizationUpdateManyMock.mockResolvedValueOnce({ count: 1 });
    const response = await POST(request(), routeContext);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.data.status).toBe("EXPIRED");
    expect(body.data.executionPerformed).toBe(false);
    expect(activityCreateMock).toHaveBeenCalledTimes(1);
  });
});
