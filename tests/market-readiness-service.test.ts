import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessMarketEntryReadiness } from "@/lib/services/market-readiness-service";

const { planFindFirstMock, obligationFindManyMock, assessmentCreateMock, auditCreateMock, transactionMock } = vi.hoisted(() => ({
  planFindFirstMock: vi.fn(),
  obligationFindManyMock: vi.fn(),
  assessmentCreateMock: vi.fn(),
  auditCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    marketEntryPlan: { findFirst: planFindFirstMock },
    complianceObligation: { findMany: obligationFindManyMock },
    $transaction: transactionMock,
  },
}));

const plan = {
  id: "market-entry-1",
  workspaceId: "workspace-1",
  version: 1,
  businessProfileId: "profile-1",
  targetJurisdictionId: "jurisdiction-1",
  formationPlanId: "formation-1",
  reviewStatus: "PENDING",
  businessProfile: {
    clientId: "client-1",
    businessName: "Example Trading",
    businessType: "Private company",
    businessObjective: "Regional distribution",
    businessModel: "Wholesale distribution",
    targetMarket: "East Africa",
    revenueModel: "Product sales",
    ownershipContext: "Privately held",
  },
  formationPlan: {
    stages: [{ tasks: [{ status: "COMPLETED" }] }],
  },
};

describe("market readiness assessment persistence", () => {
  beforeEach(() => {
    planFindFirstMock.mockReset().mockResolvedValue(plan);
    obligationFindManyMock.mockReset().mockResolvedValue([{
      status: "IN_PROGRESS",
      requiresEvidence: true,
      evidence: [],
    }]);
    assessmentCreateMock.mockReset().mockImplementation(async ({ data }) => ({ id: "assessment-1", ...data }));
    auditCreateMock.mockReset().mockResolvedValue({ id: "audit-1" });
    transactionMock.mockReset().mockImplementation((callback) => callback({
      marketReadinessAssessment: { create: assessmentCreateMock },
      marketEntryAuditEvent: { create: auditCreateMock },
    }));
  });

  it("derives and persists an assessment from data in the selected workspace and client", async () => {
    const assessedAt = new Date("2026-10-05T12:00:00.000Z");

    const result = await assessMarketEntryReadiness({
      marketEntryPlanId: "market-entry-1",
      workspaceId: "workspace-1",
      assessedByUserId: "reviewer-1",
      now: assessedAt,
    });

    expect(result?.status).toBe("PREPARATION_INCOMPLETE");
    expect(planFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "market-entry-1", workspaceId: "workspace-1" },
    }));
    expect(obligationFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: "workspace-1",
        clientId: "client-1",
        OR: [{ jurisdictionId: "jurisdiction-1" }, { jurisdictionId: null }],
      }),
    }));
    expect(assessmentCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        marketEntryPlanId: "market-entry-1",
        workspaceId: "workspace-1",
        assessedByUserId: "reviewer-1",
        assessedAt,
      }),
    }));
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: "MARKET_READINESS_ASSESSED",
        details: expect.objectContaining({ assessmentId: "assessment-1" }),
      }),
    }));
  });

  it("returns not found without reading obligations or creating a snapshot", async () => {
    planFindFirstMock.mockResolvedValue(null);

    await expect(assessMarketEntryReadiness({
      marketEntryPlanId: "outside-plan",
      workspaceId: "workspace-1",
      assessedByUserId: "user-1",
    })).resolves.toBeNull();

    expect(obligationFindManyMock).not.toHaveBeenCalled();
    expect(assessmentCreateMock).not.toHaveBeenCalled();
  });
});
