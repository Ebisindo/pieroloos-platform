import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { PATCH as reviewEvidence } from "@/app/api/compliance/obligations/[id]/evidence/[evidenceId]/review/route";
import { PATCH as updateStatus } from "@/app/api/compliance/obligations/[id]/status/route";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasInvalidRequestOrigin: vi.fn(() => false),
  withAuthorizedWorkspaceTransaction: vi.fn(),
  obligationFindFirst: vi.fn(),
  evidenceFindFirst: vi.fn(),
  evidenceUpdateMany: vi.fn(),
  activityCreate: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: mocks.getWorkspaceContext }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: mocks.hasInvalidRequestOrigin }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: mocks.withAuthorizedWorkspaceTransaction,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    complianceObligation: { findFirst: mocks.obligationFindFirst },
    complianceEvidence: { findFirst: mocks.evidenceFindFirst },
    $transaction: vi.fn(),
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
    vi.clearAllMocks();
    mocks.hasInvalidRequestOrigin.mockReturnValue(false);
    mocks.getWorkspaceContext.mockResolvedValue({ userId: principal.userId, principal });
    mocks.obligationFindFirst.mockResolvedValue({ id: "obligation-1", evidence: [{ id: "evidence-1" }] });
    mocks.evidenceFindFirst.mockResolvedValue({ id: "evidence-1", reviewStatus: "PENDING" });
    mocks.evidenceUpdateMany.mockResolvedValue({ count: 1 });
    mocks.activityCreate.mockResolvedValue({ id: "activity-1" });
    mocks.withAuthorizedWorkspaceTransaction.mockImplementation(async (
      _principal: WorkspacePrincipal,
      _permission: string,
      operation: (tx: unknown) => Promise<unknown>,
    ) => operation({
      complianceObligation: { findFirst: mocks.obligationFindFirst },
      complianceEvidence: {
        findFirst: mocks.evidenceFindFirst,
        updateMany: mocks.evidenceUpdateMany,
      },
      complianceActivity: { create: mocks.activityCreate },
    }));
    mocks.obligationFindFirst.mockResolvedValue({
      id: "obligation-1", status: "IN_REVIEW", requiresEvidence: true,
      professionalReviewRequired: false, professionalReviewCompleted: false, evidence: [],
    });
  });

  it("reviews evidence and audits the transition within an authorized transaction", async () => {
    mocks.obligationFindFirst.mockResolvedValue({ id: "obligation-1" });
    mocks.evidenceFindFirst
      .mockResolvedValueOnce({ id: "evidence-1", reviewStatus: "PENDING" })
      .mockResolvedValueOnce({ id: "evidence-1", reviewStatus: "VERIFIED" });

    const response = await reviewEvidence(
      request({ reviewStatus: "VERIFIED", note: "Source details and validity period were checked." }, "http://localhost/api/compliance/obligations/obligation-1/evidence/evidence-1/review"),
      { params: Promise.resolve({ id: "obligation-1", evidenceId: "evidence-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.withAuthorizedWorkspaceTransaction).toHaveBeenCalledWith(
      principal, "documents:review", expect.any(Function),
    );
    expect(mocks.obligationFindFirst).toHaveBeenCalledWith({
      where: { id: "obligation-1", organizationId: "org-1", workspaceId: "workspace-1" },
      select: { id: true },
    });
    expect(mocks.evidenceUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "evidence-1", obligationId: "obligation-1", workspaceId: "workspace-1", reviewStatus: "PENDING" },
      data: expect.objectContaining({ reviewStatus: "VERIFIED", reviewedByUserId: "reviewer-1" }),
    }));
    expect(mocks.activityCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        obligationId: "obligation-1",
        action: "EVIDENCE_REVIEWED",
        actorUserId: "reviewer-1",
      }),
    }));
  });

  it("rejects cross-organization obligation IDs inside the authorized transaction", async () => {
    mocks.obligationFindFirst.mockResolvedValue(null);
    const response = await reviewEvidence(
      request({ reviewStatus: "VERIFIED", note: "Reviewed." }, "http://localhost/api/compliance/obligations/foreign/evidence/evidence-1/review"),
      { params: Promise.resolve({ id: "foreign", evidenceId: "evidence-1" }) },
    );
    expect(response.status).toBe(404);
    expect(mocks.evidenceUpdateMany).not.toHaveBeenCalled();
    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });

  it("returns conflict and does not audit when the evidence status changed concurrently", async () => {
    mocks.obligationFindFirst.mockResolvedValue({ id: "obligation-1" });
    mocks.evidenceFindFirst.mockResolvedValue({ id: "evidence-1", reviewStatus: "PENDING" });
    mocks.evidenceUpdateMany.mockResolvedValue({ count: 0 });

    const response = await reviewEvidence(
      request({ reviewStatus: "VERIFIED", note: "Reviewed." }, "http://localhost/api/compliance/obligations/obligation-1/evidence/evidence-1/review"),
      { params: Promise.resolve({ id: "obligation-1", evidenceId: "evidence-1" }) },
    );
    expect(response.status).toBe(409);
    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });

  it("requires current verified evidence before marking an obligation compliant", async () => {
    const response = await updateStatus(
      request({ status: "COMPLIANT" }, "http://localhost/api/compliance/obligations/obligation-1/status"),
      { params: Promise.resolve({ id: "obligation-1" }) },
    );
    expect(response.status).toBe(409);
    expect(mocks.withAuthorizedWorkspaceTransaction).not.toHaveBeenCalled();
  });
});
