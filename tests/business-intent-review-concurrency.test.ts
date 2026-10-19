import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/ai/business-intent/proposals/[id]/review/route";

const {
  getWorkspaceContextMock,
  hasInvalidRequestOriginMock,
  authorizedTransactionMock,
  proposalFindFirstMock,
  proposalUpdateManyMock,
  proposalFindAfterUpdateMock,
  reviewCreateMock,
  activityCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  proposalFindFirstMock: vi.fn(),
  proposalUpdateManyMock: vi.fn(),
  proposalFindAfterUpdateMock: vi.fn(),
  reviewCreateMock: vi.fn(),
  activityCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: hasInvalidRequestOriginMock }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));

const principal = {
  userId: "advisor-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "advisor",
  permissions: ["formation:write"],
};
const routeContext = { params: Promise.resolve({ id: "proposal-1" }) };

function request(body: unknown) {
  return new Request("http://localhost/api/ai/business-intent/proposals/proposal-1/review", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}
const validBody = (overrides: Record<string, unknown> = {}) => ({
  decision: "CHANGES_REQUESTED",
  note: "Please verify the ownership evidence.",
  expectedVersion: 3,
  ...overrides,
});

describe("business-intent proposal review guardrails", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    hasInvalidRequestOriginMock.mockReset().mockReturnValue(false);
    proposalFindFirstMock.mockReset().mockResolvedValue({
      id: "proposal-1", status: "PROPOSED", version: 3, createdByUserId: "creator-1",
    });
    proposalUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    proposalFindAfterUpdateMock.mockReset().mockResolvedValue({
      id: "proposal-1", status: "CHANGES_REQUESTED", version: 4,
    });
    reviewCreateMock.mockReset().mockResolvedValue({ id: "review-1" });
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    authorizedTransactionMock.mockReset().mockImplementation(async (_principal, _permission, callback) => callback({
      businessIntentProposal: {
        findFirst: proposalFindFirstMock,
        updateMany: proposalUpdateManyMock,
        findAfterUpdate: proposalFindAfterUpdateMock,
      },
      businessIntentProposalReview: { create: reviewCreateMock },
      activity: { create: activityCreateMock },
    }));
  });

  it("requires expectedVersion before opening the authorized transaction", async () => {
    const response = await PATCH(request({
      decision: "APPROVED",
      note: "Approved after review.",
    }), routeContext);
    expect(response.status).toBe(422);
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects creator self-review without writes or audit records", async () => {
    proposalFindFirstMock.mockResolvedValueOnce({
      id: "proposal-1", status: "PROPOSED", version: 3, createdByUserId: principal.userId,
    });
    const response = await PATCH(request(validBody()), routeContext);
    expect(response.status).toBe(403);
    expect(proposalUpdateManyMock).not.toHaveBeenCalled();
    expect(reviewCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("rejects a stale version before writes or audit records", async () => {
    const response = await PATCH(request(validBody({ expectedVersion: 2 })), routeContext);
    expect(response.status).toBe(409);
    expect(proposalUpdateManyMock).not.toHaveBeenCalled();
    expect(reviewCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("uses a version-scoped compare-and-set and increments the winning version", async () => {
    const response = await PATCH(request(validBody()), routeContext);
    expect(response.status).toBe(200);
    expect(proposalUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "proposal-1",
        organizationId: "org-1",
        workspaceId: "workspace-1",
        version: 3,
        status: { notIn: ["APPROVED", "REJECTED"] },
      }),
      data: expect.objectContaining({ version: { increment: 1 } }),
    }));
    expect(proposalFindAfterUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "proposal-1", workspaceId: "workspace-1", version: 4 }),
    }));
    expect(reviewCreateMock).toHaveBeenCalledTimes(1);
    expect(activityCreateMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a lost compare-and-set race without review or activity writes", async () => {
    proposalUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const response = await PATCH(request(validBody()), routeContext);
    expect(response.status).toBe(409);
    expect(reviewCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });
});
