import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { POST as createDossier } from "@/app/api/cross-border/dossiers/route";
import { POST as reviewDossier } from "@/app/api/cross-border/dossiers/[id]/review/route";

const {
  getWorkspaceContextMock,
  clientFindFirstMock,
  jurisdictionFindManyMock,
  marketEntryFindFirstMock,
  dossierFindFirstMock,
  dossierCreateMock,
  dossierUpdateManyMock,
  transactionDossierFindFirstMock,
  auditCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  clientFindFirstMock: vi.fn(),
  jurisdictionFindManyMock: vi.fn(),
  marketEntryFindFirstMock: vi.fn(),
  dossierFindFirstMock: vi.fn(),
  dossierCreateMock: vi.fn(),
  dossierUpdateManyMock: vi.fn(),
  transactionDossierFindFirstMock: vi.fn(),
  auditCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    client: { findFirst: clientFindFirstMock },
    jurisdiction: { findMany: jurisdictionFindManyMock },
    marketEntryPlan: { findFirst: marketEntryFindFirstMock },
    crossBorderDossier: { findFirst: dossierFindFirstMock },
    $transaction: transactionMock,
  },
}));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:write", "compliance:read", "documents:review"],
};

const controls = [
  { status: "COMPLETE", requiresEvidence: true, _count: { evidence: 1 } },
  { status: "NOT_APPLICABLE", requiresEvidence: false, _count: { evidence: 0 } },
];

function request(body: unknown, url = "http://localhost/api/cross-border/dossiers") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("cross-border dossier routes", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    clientFindFirstMock.mockReset().mockResolvedValue({ id: "client-1", businessProfile: { id: "profile-1" } });
    jurisdictionFindManyMock.mockReset().mockResolvedValue([{ id: "origin-1" }, { id: "destination-1" }]);
    marketEntryFindFirstMock.mockReset().mockResolvedValue({ id: "market-entry-1" });
    dossierFindFirstMock.mockReset().mockResolvedValue({ id: "dossier-1", version: 3, status: "PREPARING", controls });
    dossierCreateMock.mockReset().mockImplementation(async ({ data }) => ({ id: "dossier-1", ...data }));
    dossierUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    transactionDossierFindFirstMock.mockReset().mockResolvedValue({ id: "dossier-1", version: 4, status: "REVIEWED" });
    auditCreateMock.mockReset().mockResolvedValue({ id: "audit-1" });
    transactionMock.mockReset().mockImplementation((callback) => callback({
      membership: { findUnique: vi.fn().mockResolvedValue({ role: "OWNER" }) },
      workspace: { findFirst: vi.fn().mockResolvedValue({ id: "workspace-1" }) },
      crossBorderDossier: {
        create: dossierCreateMock,
        updateMany: dossierUpdateManyMock,
        findFirst: transactionDossierFindFirstMock,
      },
      crossBorderDossierAuditEvent: { create: auditCreateMock },
    }));
  });

  it("creates a dossier only for workspace clients and available jurisdictions", async () => {
    const response = await createDossier(request({
      clientId: "client-1",
      marketEntryPlanId: "market-entry-1",
      originJurisdictionId: "origin-1",
      destinationJurisdictionId: "destination-1",
      counterpartyName: "Regional buyer",
      activityDescription: "Prepare a wholesale supply transaction for review.",
      currencyCode: "usd",
      estimatedValue: "1250.50",
    }));

    expect(response.status).toBe(201);
    expect(dossierCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-1",
        clientId: "client-1",
        marketEntryPlanId: "market-entry-1",
        currencyCode: "USD",
        estimatedValue: "1250.50",
        createdByUserId: "user-1",
      }),
    }));
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: "DOSSIER_CREATED" }),
    }));
  });

  it("rejects a linked market-entry pathway for a different target", async () => {
    marketEntryFindFirstMock.mockResolvedValue(null);
    const response = await createDossier(request({
      clientId: "client-1",
      marketEntryPlanId: "other-plan",
      originJurisdictionId: "origin-1",
      destinationJurisdictionId: "destination-1",
      counterpartyName: "Regional buyer",
      activityDescription: "Prepare a wholesale supply transaction for review.",
    }));

    expect(response.status).toBe(422);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("blocks internal review until controls and evidence are complete", async () => {
    dossierFindFirstMock.mockResolvedValue({
      id: "dossier-1",
      version: 3,
      status: "PREPARING",
      controls: [{ status: "IN_PROGRESS", requiresEvidence: true, _count: { evidence: 0 } }],
    });
    const response = await reviewDossier(request({
      status: "REVIEWED",
      note: "The transaction preparation has been reviewed.",
      expectedVersion: 3,
    }, "http://localhost/api/cross-border/dossiers/dossier-1/review"), {
      params: Promise.resolve({ id: "dossier-1" }),
    });

    expect(response.status).toBe(409);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("records review outcome with expected-version check and audit event", async () => {
    const response = await reviewDossier(request({
      status: "REVIEWED",
      note: "The transaction preparation has been reviewed.",
      expectedVersion: 3,
    }, "http://localhost/api/cross-border/dossiers/dossier-1/review"), {
      params: Promise.resolve({ id: "dossier-1" }),
    });

    expect(response.status).toBe(200);
    expect(dossierUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "dossier-1", workspaceId: "workspace-1", version: 3, status: { not: "ARCHIVED" } },
      data: expect.objectContaining({ status: "REVIEWED", version: { increment: 1 } }),
    }));
    expect(auditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: "DOSSIER_REVIEW_RECORDED" }),
    }));
  });
});
