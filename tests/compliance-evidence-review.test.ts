import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { PATCH as reviewEvidence } from "@/app/api/compliance/obligations/[id]/evidence/[evidenceId]/review/route";
import { PATCH as updateStatus } from "@/app/api/compliance/obligations/[id]/status/route";

const {
  getWorkspaceContextMock,
  obligationFindFirstMock,
  evidenceFindFirstMock,
  evidenceUpdateManyMock,
  activityCreateMock,
  transactionMock,
  transactionObligationFindFirstMock,
  transactionObligationUpdateManyMock,
  transactionObligationFindFirstOrThrowMock,
  statusSnapshotAggregateMock,
  statusSnapshotCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  obligationFindFirstMock: vi.fn(),
  evidenceFindFirstMock: vi.fn(),
  evidenceUpdateManyMock: vi.fn(),
  activityCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  transactionObligationFindFirstMock: vi.fn(),
  transactionObligationUpdateManyMock: vi.fn(),
  transactionObligationFindFirstOrThrowMock: vi.fn(),
  statusSnapshotAggregateMock: vi.fn(),
  statusSnapshotCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    complianceObligation: { findFirst: obligationFindFirstMock },
    complianceEvidence: { findFirst: evidenceFindFirstMock },
    $transaction: transactionMock,
  },
}));

const principal: WorkspacePrincipal = {
  userId: "reviewer-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:write", "documents:review"],
};

function request(body: unknown, url: string) {
  return new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("compliance evidence governance", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    obligationFindFirstMock.mockReset().mockResolvedValue({ id: "obligation-1", evidence: [{ id: "evidence-1" }] });
    evidenceFindFirstMock.mockReset().mockResolvedValue({ id: "evidence-1", reviewStatus: "PENDING" });
    evidenceUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    transactionObligationFindFirstMock.mockReset().mockResolvedValue({
      id: "obligation-1", status: "IN_REVIEW", completedAt: null, requiresEvidence: false,
      professionalReviewRequired: false, professionalReviewCompleted: false, evidence: [{ id: "evidence-1" }],
    });
    transactionObligationUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    transactionObligationFindFirstOrThrowMock.mockReset().mockResolvedValue({ id: "obligation-1", status: "COMPLIANT" });
    statusSnapshotAggregateMock.mockReset().mockResolvedValue({ _max: { sequence: 0 } });
    statusSnapshotCreateMock.mockReset().mockResolvedValue({ id: "status-snapshot-1" });
    transactionMock.mockReset().mockImplementation((callback) => callback({
      membership: { findUnique: vi.fn().mockResolvedValue({ role: "OWNER" }) },
      workspace: { findFirst: vi.fn().mockResolvedValue({ id: "workspace-1" }) },
      complianceEvidence: {
        updateMany: evidenceUpdateManyMock,
        findFirst: vi.fn().mockResolvedValue({ id: "evidence-1", reviewStatus: "VERIFIED" }),
      },
      complianceObligation: {
        findFirst: transactionObligationFindFirstMock,
        updateMany: transactionObligationUpdateManyMock,
        findFirstOrThrow: transactionObligationFindFirstOrThrowMock,
      },
      complianceStatusSnapshot: { aggregate: statusSnapshotAggregateMock, create: statusSnapshotCreateMock },
      complianceActivity: { create: activityCreateMock },
    }));
  });

  it("records evidence verification and its audit activity in one transaction", async () => {
    const response = await reviewEvidence(
      request({ reviewStatus: "VERIFIED", note: "Source details and validity period were checked." }, "http://localhost/api/compliance/obligations/obligation-1/evidence/evidence-1/review"),
      { params: Promise.resolve({ id: "obligation-1", evidenceId: "evidence-1" }) },
    );

    expect(response.status).toBe(200);
    expect(obligationFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "obligation-1", workspaceId: "workspace-1" },
    }));
    expect(evidenceUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "evidence-1", obligationId: "obligation-1" },
      data: expect.objectContaining({
        reviewStatus: "VERIFIED",
        reviewedByUserId: "reviewer-1",
      }),
    }));
    expect(activityCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        obligationId: "obligation-1",
        action: "EVIDENCE_REVIEWED",
        actorUserId: "reviewer-1",
      }),
    }));
  });

  it("rejects evidence review when the obligation is outside the active workspace", async () => {
    obligationFindFirstMock.mockResolvedValue(null);

    const response = await reviewEvidence(
      request({ reviewStatus: "VERIFIED", note: "Reviewed." }, "http://localhost/api/compliance/obligations/obligation-1/evidence/evidence-1/review"),
      { params: Promise.resolve({ id: "obligation-1", evidenceId: "evidence-1" }) },
    );

    expect(response.status).toBe(404);
    expect(transactionMock).not.toHaveBeenCalled();
  });


  it("rejects a stale expected status before applying side effects", async () => {
    transactionObligationFindFirstMock.mockResolvedValueOnce({
      id: "obligation-1", status: "IN_REVIEW", completedAt: null,
      requiresEvidence: false, professionalReviewRequired: false,
      professionalReviewCompleted: false, evidence: [{ id: "evidence-1" }],
    });
    const response = await updateStatus(
      request({ status: "COMPLIANT", expectedStatus: "NOT_STARTED" }, "http://localhost/api/compliance/obligations/obligation-1/status"),
      { params: Promise.resolve({ id: "obligation-1" }) },
    );
    expect(response.status).toBe(409);
    expect(transactionObligationUpdateManyMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("preserves the first completion timestamp and records each transition", async () => {
    const completedAt = new Date("2026-09-01T10:00:00.000Z");
    transactionObligationFindFirstMock.mockResolvedValueOnce({
      id: "obligation-1", status: "IN_REVIEW", completedAt,
      requiresEvidence: false, professionalReviewRequired: false,
      professionalReviewCompleted: false, evidence: [{ id: "evidence-1" }],
    });
    const response = await updateStatus(
      request({ status: "COMPLIANT", expectedStatus: "IN_REVIEW", note: "Review is complete." }, "http://localhost/api/compliance/obligations/obligation-1/status"),
      { params: Promise.resolve({ id: "obligation-1" }) },
    );
    expect(response.status).toBe(200);
    expect(transactionObligationUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "COMPLIANT", completedAt },
    }));
    expect(statusSnapshotCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sequence: 1,
        previousStatus: "IN_REVIEW",
        currentStatus: "COMPLIANT",
        completedAtBefore: completedAt,
        completedAtAfter: completedAt,
      }),
    }));
    expect(activityCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "STATUS_CHANGED",
        metadata: expect.objectContaining({
          from: "IN_REVIEW",
          to: "COMPLIANT",
          completedAtBefore: completedAt.toISOString(),
          completedAtAfter: completedAt.toISOString(),
        }),
      }),
    }));
  });

  it("requires current verified evidence before marking an obligation compliant", async () => {
    transactionObligationFindFirstMock.mockResolvedValue({
      id: "obligation-1", status: "IN_REVIEW", completedAt: null,
      requiresEvidence: true, professionalReviewRequired: false,
      professionalReviewCompleted: false, evidence: [],
    });

    const response = await updateStatus(
      request({ status: "COMPLIANT" }, "http://localhost/api/compliance/obligations/obligation-1/status"),
      { params: Promise.resolve({ id: "obligation-1" }) },
    );

    expect(response.status).toBe(409);
    expect(transactionObligationUpdateManyMock).not.toHaveBeenCalled();
    expect(statusSnapshotCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });
});
