import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { POST as createPlan } from "@/app/api/market-entry/route";
import { PATCH as updateStatus } from "@/app/api/market-entry/[id]/route";
import { POST as recordReview } from "@/app/api/market-entry/[id]/review/route";

const {
  getWorkspaceContextMock,
  comparisonFindFirstMock,
  profileFindFirstMock,
  jurisdictionFindFirstMock,
  formationFindFirstMock,
  decisionFindFirstMock,
  decisionCreateMock,
  planFindFirstMock,
  readinessFindFirstMock,
  planCreateMock,
  planUpdateManyMock,
  transactionPlanFindFirstMock,
  auditCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  comparisonFindFirstMock: vi.fn(),
  profileFindFirstMock: vi.fn(),
  jurisdictionFindFirstMock: vi.fn(),
  formationFindFirstMock: vi.fn(),
  decisionFindFirstMock: vi.fn(),
  decisionCreateMock: vi.fn(),
  planFindFirstMock: vi.fn(),
  readinessFindFirstMock: vi.fn(),
  planCreateMock: vi.fn(),
  planUpdateManyMock: vi.fn(),
  transactionPlanFindFirstMock: vi.fn(),
  auditCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    jurisdictionComparison: { findFirst: comparisonFindFirstMock },
    businessProfile: { findFirst: profileFindFirstMock },
    jurisdiction: { findFirst: jurisdictionFindFirstMock },
    formationPlan: { findFirst: formationFindFirstMock },
    marketEntryPlan: { findFirst: planFindFirstMock },
    marketReadinessAssessment: { findFirst: readinessFindFirstMock },
    $transaction: transactionMock,
  },
}));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  permissions: ["jurisdictions:read", "jurisdictions:write", "documents:review"],
};

const marketPlan = {
  id: "market-plan-1",
  workspaceId: "workspace-1",
  status: "ASSESSING",
  reviewStatus: "PENDING",
  version: 2,
  reviewedAssessmentVersion: null,
};

const currentReadinessAssessment = {
  id: "assessment-1",
  planVersion: 2,
  status: "READY_FOR_REVIEW",
  resultJson: {
    status: "READY_FOR_REVIEW",
    assessedAt: "2026-10-05T12:00:00.000Z",
    boundary: "Internal preparation only.",
    checks: [
      "business-profile",
      "formalization",
      "obligations",
      "obligation-evidence",
    ].map((key) => ({ key, title: key, status: "COMPLETE", summary: "Complete.", nextSteps: [] })),
  },
};

function request(body: unknown, path = "http://localhost/api/market-entry") {
  return new Request(path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("market-entry routes", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    comparisonFindFirstMock.mockReset().mockResolvedValue({
      id: "comparison-1",
      businessProfileId: "profile-1",
      jurisdictionIdsJson: JSON.stringify(["jurisdiction-1", "jurisdiction-2"]),
    });
    profileFindFirstMock.mockReset().mockResolvedValue({ id: "profile-1" });
    jurisdictionFindFirstMock.mockReset().mockResolvedValue({ id: "jurisdiction-1" });
    formationFindFirstMock.mockReset().mockResolvedValue({ id: "formation-1" });
    decisionFindFirstMock.mockReset().mockResolvedValue(null);
    decisionCreateMock.mockReset().mockResolvedValue({ id: "decision-1" });
    planFindFirstMock.mockReset().mockResolvedValue(marketPlan);
    readinessFindFirstMock.mockReset().mockResolvedValue(currentReadinessAssessment);
    planCreateMock.mockReset().mockResolvedValue({ id: "market-plan-1", version: 1 });
    planUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    transactionPlanFindFirstMock.mockReset().mockResolvedValue({ ...marketPlan, version: 3 });
    auditCreateMock.mockReset().mockResolvedValue({ id: "audit-1" });
    transactionMock.mockReset().mockImplementation((callback) => callback({
      workingJurisdictionDecision: {
        findFirst: decisionFindFirstMock,
        create: decisionCreateMock,
      },
      marketEntryPlan: {
        create: planCreateMock,
        updateMany: planUpdateManyMock,
        findFirst: transactionPlanFindFirstMock,
      },
      marketEntryAuditEvent: { create: auditCreateMock },
    }));
  });

  it("creates a pathway only from a saved, workspace-scoped comparison and audits it", async () => {
    const response = await createPlan(request({
      comparisonSnapshotId: "comparison-1",
      targetJurisdictionId: "jurisdiction-1",
      rationale: "Customers and regional distributors are concentrated in this market.",
      formationPlanId: "formation-1",
    }));

    expect(response.status).toBe(201);
    expect(planCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        organizationId: "org-1",
        businessProfileId: "profile-1",
        targetJurisdictionId: "jurisdiction-1",
        formationPlanId: "formation-1",
        workingJurisdictionDecisionId: expect.stringMatching(/^decision-/),
      }),
    }));
    expect(decisionCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        businessProfileId: "profile-1",
        comparisonSnapshotId: "comparison-1",
        jurisdictionId: "jurisdiction-1",
        professionalReviewRequired: true,
      }),
    }));
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorUserId: "user-1",
        eventType: "MARKET_ENTRY_CREATED",
      }),
    }));
  });

  it("rejects targets absent from the saved comparison", async () => {
    const response = await createPlan(request({
      comparisonSnapshotId: "comparison-1",
      targetJurisdictionId: "outside-jurisdiction",
      rationale: "Customers and regional distributors are concentrated in this market.",
    }));

    expect(response.status).toBe(422);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("requires the professional-review permission before writing a review", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: ["jurisdictions:read", "jurisdictions:write"] },
    });

    const response = await recordReview(request({
      reviewStatus: "APPROVED",
      note: "Reviewed the assumptions and documented applicable open questions.",
      expectedVersion: 2,
    }, "http://localhost/api/market-entry/market-plan-1/review"), {
      params: Promise.resolve({ id: "market-plan-1" }),
    });

    expect(response.status).toBe(403);
    expect(planFindFirstMock).not.toHaveBeenCalled();
  });

  it("records a versioned professional review and append-only audit", async () => {
    const response = await recordReview(request({
      reviewStatus: "CHANGES_REQUESTED",
      note: "Clarify the operating model and add the missing ownership details.",
      expectedVersion: 2,
    }, "http://localhost/api/market-entry/market-plan-1/review"), {
      params: Promise.resolve({ id: "market-plan-1" }),
    });

    expect(response.status).toBe(200);
    expect(planUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "market-plan-1", workspaceId: "workspace-1", version: 2 },
      data: expect.objectContaining({
        reviewStatus: "CHANGES_REQUESTED",
        reviewedAssessmentVersion: null,
        version: { increment: 1 },
      }),
    }));
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: "MARKET_ENTRY_REVIEW_RECORDED" }),
    }));
  });

  it("approves a complete, current preparation assessment", async () => {
    const response = await recordReview(request({
      reviewStatus: "APPROVED",
      note: "Reviewed the recorded preparation and open operating boundaries.",
      expectedVersion: 2,
    }, "http://localhost/api/market-entry/market-plan-1/review"), {
      params: Promise.resolve({ id: "market-plan-1" }),
    });

    expect(response.status).toBe(200);
    expect(planUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reviewStatus: "APPROVED",
        reviewedAssessmentVersion: 2,
      }),
    }));
  });

  it("does not approve an incomplete preparation assessment", async () => {
    readinessFindFirstMock.mockResolvedValue({
      ...currentReadinessAssessment,
      status: "PREPARATION_INCOMPLETE",
      resultJson: {
        ...currentReadinessAssessment.resultJson,
        status: "PREPARATION_INCOMPLETE",
        checks: currentReadinessAssessment.resultJson.checks.map((check) =>
          check.key === "obligations" ? { ...check, status: "NEEDS_INPUT" } : check,
        ),
      },
    });

    const response = await recordReview(request({
      reviewStatus: "APPROVED",
      note: "Reviewed the recorded preparation and open operating boundaries.",
      expectedVersion: 2,
    }, "http://localhost/api/market-entry/market-plan-1/review"), {
      params: Promise.resolve({ id: "market-plan-1" }),
    });

    expect(response.status).toBe(409);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("does not record a review when the latest assessment is stale", async () => {
    readinessFindFirstMock.mockResolvedValue({ ...currentReadinessAssessment, planVersion: 1 });

    const response = await recordReview(request({
      reviewStatus: "APPROVED",
      note: "Reviewed the assumptions and documented applicable open questions.",
      expectedVersion: 2,
    }, "http://localhost/api/market-entry/market-plan-1/review"), {
      params: Promise.resolve({ id: "market-plan-1" }),
    });

    expect(response.status).toBe(409);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("requires recorded professional review before a pathway can start", async () => {
    const response = await updateStatus(request({
      status: "IN_PROGRESS",
      expectedVersion: 2,
    }, "http://localhost/api/market-entry/market-plan-1"), {
      params: Promise.resolve({ id: "market-plan-1" }),
    });

    expect(response.status).toBe(409);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutation requests", async () => {
    const crossOrigin = new Request("http://localhost/api/market-entry", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify({
        comparisonSnapshotId: "comparison-1",
        targetJurisdictionId: "jurisdiction-1",
        rationale: "Customers and regional distributors are concentrated in this market.",
      }),
    });

    const response = await createPlan(crossOrigin);

    expect(response.status).toBe(403);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
  });
});
