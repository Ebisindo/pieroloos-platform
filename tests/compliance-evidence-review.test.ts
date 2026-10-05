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
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  obligationFindFirstMock: vi.fn(),
  evidenceFindFirstMock: vi.fn(),
  evidenceUpdateManyMock: vi.fn(),
  activityCreateMock: vi.fn(),
  transactionMock: vi.fn(),
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
    transactionMock.mockReset().mockImplementation((callback) => callback({
      complianceEvidence: {
        updateMany: evidenceUpdateManyMock,
        findFirst: vi.fn().mockResolvedValue({ id: "evidence-1", reviewStatus: "VERIFIED" }),
      },
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

  it("requires current verified evidence before marking an obligation compliant", async () => {
    obligationFindFirstMock.mockResolvedValue({
      id: "obligation-1",
      status: "IN_REVIEW",
      requiresEvidence: true,
      professionalReviewRequired: false,
      professionalReviewCompleted: false,
      evidence: [],
    });

    const response = await updateStatus(
      request({ status: "COMPLIANT" }, "http://localhost/api/compliance/obligations/obligation-1/status"),
      { params: Promise.resolve({ id: "obligation-1" }) },
    );

    expect(response.status).toBe(409);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
