import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { POST as attachEvidence } from "@/app/api/compliance/obligations/[id]/evidence/route";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasInvalidRequestOrigin: vi.fn(() => false),
  withAuthorizedWorkspaceTransaction: vi.fn(),
  obligationFindFirst: vi.fn(),
  documentFindFirst: vi.fn(),
  evidenceCreate: vi.fn(),
  activityCreate: vi.fn(),
  accessEventCreate: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: mocks.getWorkspaceContext }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: mocks.hasInvalidRequestOrigin }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: mocks.withAuthorizedWorkspaceTransaction,
}));
vi.mock("@/lib/validation/compliance", async (importOriginal) => importOriginal());
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["documents:write"],
};

function request(body: unknown) {
  return new Request("http://localhost/api/compliance/obligations/obligation-1/evidence", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("compliance evidence attachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkspaceContext.mockResolvedValue({ userId: principal.userId, principal });
    mocks.obligationFindFirst.mockResolvedValue({ id: "obligation-1", clientId: "client-1" });
    mocks.documentFindFirst.mockResolvedValue({ id: "document-1" });
    mocks.evidenceCreate.mockImplementation(async ({ data }) => ({ id: "evidence-1", ...data }));
    mocks.activityCreate.mockResolvedValue({ id: "activity-1" });
    mocks.accessEventCreate.mockResolvedValue({ id: "access-1" });
    mocks.withAuthorizedWorkspaceTransaction.mockImplementation(async (
      _principal: WorkspacePrincipal,
      _permission: string,
      operation: (tx: unknown) => Promise<unknown>,
    ) => operation({
      complianceObligation: { findFirst: mocks.obligationFindFirst },
      document: { findFirst: mocks.documentFindFirst },
      documentAccessEvent: { create: mocks.accessEventCreate },
      complianceEvidence: { create: mocks.evidenceCreate },
      complianceActivity: { create: mocks.activityCreate },
    }));
  });

  it("stores the selected validity date through the end of that calendar day", async () => {
    const response = await attachEvidence(request({
      documentId: "document-1",
      evidenceClass: "E1",
      sourceReference: "Registry receipt R-104",
      validThrough: "2027-03-14",
    }), { params: Promise.resolve({ id: "obligation-1" }) });

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(new Date(payload.data.validThrough).toISOString()).toBe("2027-03-14T23:59:59.999Z");
    expect(mocks.obligationFindFirst).toHaveBeenCalledWith({
      where: { id: "obligation-1", organizationId: "org-1", workspaceId: "workspace-1" },
      select: { id: true, clientId: true },
    });
    expect(mocks.documentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "document-1",
        workspaceId: "workspace-1",
        clientId: "client-1",
        status: "AVAILABLE",
        scanStatus: "CLEAN",
      }),
    }));
    expect(mocks.evidenceCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceReference: "Registry receipt R-104",
        validThrough: new Date("2027-03-14T23:59:59.999Z"),
      }),
    }));
    expect(mocks.activityCreate).toHaveBeenCalled();
  });

  it("requires the document to belong to the same client and workspace", async () => {
    mocks.documentFindFirst.mockResolvedValue(null);
    const response = await attachEvidence(request({
      documentId: "outside-document",
      evidenceClass: "E1",
    }), { params: Promise.resolve({ id: "obligation-1" }) });

    expect(response.status).toBe(404);
    expect(mocks.evidenceCreate).not.toHaveBeenCalled();
    expect(mocks.activityCreate).not.toHaveBeenCalled();
  });

  it("rejects obligations outside the active organization and workspace", async () => {
    mocks.obligationFindFirst.mockResolvedValue(null);
    const response = await attachEvidence(request({
      documentId: "document-1",
      evidenceClass: "E1",
    }), { params: Promise.resolve({ id: "foreign-obligation" }) });

    expect(response.status).toBe(404);
    expect(mocks.documentFindFirst).not.toHaveBeenCalled();
    expect(mocks.evidenceCreate).not.toHaveBeenCalled();
  });
});
