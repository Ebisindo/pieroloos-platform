import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/ai/business-intent/proposals/[id]/review/route";

const {
  getWorkspaceContextMock,
  hasInvalidRequestOriginMock,
  authorizedTransactionMock,
  proposalFindFirstMock,
  proposalUpdateManyMock,
  reviewCreateMock,
  activityCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  proposalFindFirstMock: vi.fn(),
  proposalUpdateManyMock: vi.fn(),
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
const body = (overrides: Record<string, unknown> = {}) => ({
  decision: "CHANGES_REQUESTED",
  note: "Please verify the ownership evidence.",
  expectedVersion: 3,
  ...overrides,
});

describe("business-intent proposal review concurrency", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    hasInvalidRequestOriginMock.mockReset().mockReturnValue(false);
    proposalFindFirstMock.mockReset().mockResolvedValue({
      id: "proposal-1",
      status: "PROPOSED",
      version: 3,
      createdByUserId: "creator-1",
    });
    proposalUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    reviewCreateMock.mockReset().mockResolvedValue({ id: "review-1" });
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    authorizedTransactionMock.mockReset().mockImplementation(async (_principal, _permission, callback) => callback({
      businessIntentProposal: {
        findFirst: proposalFindFirstMock,
        updateMany: proposalUpdateManyMock,
      },
      businessIntentProposalReview: { create: reviewCreateMock },
      activity: { create: activityCreateMock },
    }));
  });

  it("requires the caller's expected proposal version", async () => {
    const response = await PATCH(request({ decision: "APPROVED", note: "Approved after review." }), routeContext);
    expect(response.status).toBe(422);
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("returns conflict and creates no review/audit when the proposal version is stale", async () => {
    proposalFindFirstMock.mockResolvedValueOnce({
      id: "proposal-1", status: "PROPOSED", version: 4, createdByUserId: "creator-1",
    });
    const response = await PATCH(request(body({ expectedVersion: 3 })), routeContext);
    expect(response.status).toBe(409);
    expect(proposalUpdateManyMock).not.toHaveBeenCalled();
    expect(reviewCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("uses a conditional versioned update before writing review history", async () => {
    proposalFindFirstMock
      .mockResolvedValueOnce({ id: "proposal-1", status: "PROPOSED", version: 3, createdByUserId: "creator-1" })
      .mockResolvedValueOnce({ id: "proposal-1", status: "CHANGES_REQUESTED", version: 4 });
    const response = await PATCH(request(body()), routeContext);
    expect(response.status).toBe(200);
    expect(proposalUpdateManyMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "proposal-1",
        organizationId: "org-1",
        workspaceId: "workspace-1",
        version: 3,
        status: { notIn: ["APPROVED", "REJECTED"] },
      }),
      data: expect.objectContaining({
        status: "CHANGES_REQUESTED",
        version: { increment: 1 },
      }),
    });
    expect(reviewCreateMock).toHaveBeenCalledTimes(1);
    expect(activityCreateMock).toHaveBeenCalledTimes(1);
  });

  it("returns conflict when another reviewer wins the conditional update race", async () => {
    proposalUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const response = await PATCH(request(body()), routeContext);
    expect(response.status).toBe(409);
    expect(reviewCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });
  it("prevents the proposal creator from reviewing their own proposal", async () => {
    proposalFindFirstMock.mockResolvedValueOnce({
      id: "proposal-1",
      status: "PROPOSED",
      version: 3,
      createdByUserId: principal.userId,
    });
    const response = await PATCH(request(body({ decision: "APPROVED" })), routeContext);
    expect(response.status).toBe(403);
    expect(proposalUpdateManyMock).not.toHaveBeenCalled();
    expect(reviewCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

});
