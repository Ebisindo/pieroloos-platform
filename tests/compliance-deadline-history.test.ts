import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { PATCH } from "@/app/api/compliance/obligations/[id]/deadline/route";

const {
  getWorkspaceContextMock, hasInvalidRequestOriginMock, authorizedTransactionMock,
  obligationFindFirstMock, ruleVersionFindFirstMock, snapshotAggregateMock, snapshotCreateMock,
  obligationUpdateManyMock, activityCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  obligationFindFirstMock: vi.fn(),
  ruleVersionFindFirstMock: vi.fn(),
  snapshotAggregateMock: vi.fn(),
  snapshotCreateMock: vi.fn(),
  obligationUpdateManyMock: vi.fn(),
  activityCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: hasInvalidRequestOriginMock }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));

const principal: WorkspacePrincipal = {
  userId: "staff-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:write"],
};

const oldDueAt = new Date("2027-03-01T00:00:00.000Z");
const nextDueAt = new Date("2027-04-01T00:00:00.000Z");
const body = (overrides: Record<string, unknown> = {}) => ({
  dueAt: nextDueAt.toISOString(),
  reason: "Verified a revised administrative date.",
  assessmentFacts: { source: "manual evidence review", assessmentState: "UNKNOWN" },
  ...overrides,
});
function request(value: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/compliance/obligations/obligation-1/deadline", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(value),
  });
}
const routeContext = { params: Promise.resolve({ id: "obligation-1" }) };

describe("compliance deadline history integrity", () => {
  beforeEach(() => {
    hasInvalidRequestOriginMock.mockReset().mockReturnValue(false);
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    obligationFindFirstMock.mockReset().mockResolvedValue({
      id: "obligation-1",
      jurisdictionId: "jurisdiction-1",
      dueAt: oldDueAt,
      sourceRuleVersionId: null,
    });
    ruleVersionFindFirstMock.mockReset().mockResolvedValue(null);
    snapshotAggregateMock.mockReset().mockResolvedValue({ _max: { sequence: 3 } });
    snapshotCreateMock.mockReset().mockResolvedValue({ id: "snapshot-4", sequence: 4 });
    obligationUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    authorizedTransactionMock.mockReset().mockImplementation(async (_principal, _permission, callback) => callback({
      complianceObligation: { findFirst: obligationFindFirstMock, updateMany: obligationUpdateManyMock },
      complianceRuleVersion: { findFirst: ruleVersionFindFirstMock },
      complianceDeadlineSnapshot: { aggregate: snapshotAggregateMock, create: snapshotCreateMock },
      complianceActivity: { create: activityCreateMock },
    }));
  });

  it("appends an ordered deadline snapshot and audit activity atomically", async () => {
    const response = await PATCH(request(body()), routeContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { id: "snapshot-4", sequence: 4 }, currentDueAt: nextDueAt.toISOString() });
    expect(snapshotCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        obligationId: "obligation-1",
        workspaceId: "workspace-1",
        sequence: 4,
        previousDueAt: oldDueAt,
        dueAt: nextDueAt,
        assessmentState: "UNKNOWN",
        actorUserId: "staff-1",
      }),
    });
    expect(obligationUpdateManyMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "obligation-1",
        organizationId: "org-1",
        workspaceId: "workspace-1",
        dueAt: oldDueAt,
        sourceRuleVersionId: null,
      }),
      data: { dueAt: nextDueAt, sourceRuleVersionId: null },
    });
    expect(activityCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        obligationId: "obligation-1",
        action: "DEADLINE_CHANGED",
        actorUserId: "staff-1",
        metadata: expect.objectContaining({ snapshotId: "snapshot-4", sequence: 4 }),
      }),
    });
  });

  it("retains an unknown deadline as null rather than converting it into an epoch timestamp", async () => {
    const response = await PATCH(request(body({ dueAt: null, reason: "No reliable deadline has been established." })), routeContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ currentDueAt: null });
    expect(snapshotCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ previousDueAt: oldDueAt, dueAt: null, assessmentState: "UNKNOWN" }),
    });
    expect(obligationUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { dueAt: null, sourceRuleVersionId: null },
    }));
  });

  it("returns not found for an obligation outside the active organization and workspace", async () => {
    obligationFindFirstMock.mockResolvedValueOnce(null);
    const response = await PATCH(request(body()), routeContext);
    expect(response.status).toBe(404);
    expect(snapshotCreateMock).not.toHaveBeenCalled();
    expect(obligationUpdateManyMock).not.toHaveBeenCalled();
  });

  it("does not append history when the obligation changed concurrently", async () => {
    obligationUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const response = await PATCH(request(body()), routeContext);
    expect(response.status).toBe(409);
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("requires a verified same-jurisdiction rule version before attaching it to a deadline", async () => {
    ruleVersionFindFirstMock.mockResolvedValueOnce({
      id: "version-1",
      jurisdictionId: "other-jurisdiction",
      reviewState: "UNREVIEWED",
    });
    const response = await PATCH(request(body({ sourceRuleVersionId: "version-1" })), routeContext);
    expect(response.status).toBe(409);
    expect(snapshotCreateMock).not.toHaveBeenCalled();
    expect(obligationUpdateManyMock).not.toHaveBeenCalled();
  });

  it("checks request origin before opening workspace or transaction", async () => {
    hasInvalidRequestOriginMock.mockReturnValue(true);
    const response = await PATCH(request(body(), "https://attacker.invalid"), routeContext);
    expect(response.status).toBe(403);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });
});
