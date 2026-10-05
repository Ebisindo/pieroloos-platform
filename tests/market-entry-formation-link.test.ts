import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { POST } from "@/app/api/market-entry/[id]/formation-plan/route";

const {
  getWorkspaceContextMock,
  planFindFirstMock,
  formationFindFirstMock,
  planUpdateManyMock,
  transactionPlanFindFirstMock,
  auditCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  planFindFirstMock: vi.fn(),
  formationFindFirstMock: vi.fn(),
  planUpdateManyMock: vi.fn(),
  transactionPlanFindFirstMock: vi.fn(),
  auditCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    marketEntryPlan: { findFirst: planFindFirstMock },
    formationPlan: { findFirst: formationFindFirstMock },
    $transaction: transactionMock,
  },
}));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["formation:write"],
};

describe("market-entry formation plan linking", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    planFindFirstMock.mockReset().mockResolvedValue({
      id: "market-entry-1",
      workspaceId: "workspace-1",
      businessProfileId: "profile-1",
      targetJurisdictionId: "jurisdiction-1",
      formationPlanId: null,
      status: "ASSESSING",
      version: 3,
    });
    formationFindFirstMock.mockReset().mockResolvedValue({ id: "formation-1" });
    planUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    transactionPlanFindFirstMock.mockReset().mockResolvedValue({ id: "market-entry-1", formationPlanId: "formation-1", version: 4 });
    auditCreateMock.mockReset().mockResolvedValue({ id: "audit-1" });
    transactionMock.mockReset().mockImplementation((callback) => callback({
      membership: { findUnique: vi.fn().mockResolvedValue({ role: "OWNER" }) },
      workspace: { findFirst: vi.fn().mockResolvedValue({ id: "workspace-1" }) },
      marketEntryPlan: { updateMany: planUpdateManyMock, findFirst: transactionPlanFindFirstMock },
      marketEntryAuditEvent: { create: auditCreateMock },
    }));
  });

  it("links only a same-workspace formation plan for the same profile and jurisdiction", async () => {
    const response = await POST(new Request("http://localhost/api/market-entry/market-entry-1/formation-plan", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ formationPlanId: "formation-1", expectedVersion: 3 }),
    }), { params: Promise.resolve({ id: "market-entry-1" }) });

    expect(response.status).toBe(200);
    expect(formationFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "formation-1",
        workspaceId: "workspace-1",
        businessProfileId: "profile-1",
        jurisdictionId: "jurisdiction-1",
      },
    }));
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: "MARKET_ENTRY_FORMATION_PLAN_LINKED" }),
    }));
  });

  it("rejects a stale link without updating or auditing", async () => {
    planUpdateManyMock.mockResolvedValue({ count: 0 });

    const response = await POST(new Request("http://localhost/api/market-entry/market-entry-1/formation-plan", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ formationPlanId: "formation-1", expectedVersion: 3 }),
    }), { params: Promise.resolve({ id: "market-entry-1" }) });

    expect(response.status).toBe(409);
    expect(auditCreateMock).not.toHaveBeenCalled();
  });
});
