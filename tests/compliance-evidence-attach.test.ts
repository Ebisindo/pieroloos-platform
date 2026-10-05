import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { POST as attachEvidence } from "@/app/api/compliance/obligations/[id]/evidence/route";

const {
  getWorkspaceContextMock,
  obligationFindFirstMock,
  documentFindFirstMock,
  evidenceCreateMock,
  activityCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  obligationFindFirstMock: vi.fn(),
  documentFindFirstMock: vi.fn(),
  evidenceCreateMock: vi.fn(),
  activityCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    complianceObligation: { findFirst: obligationFindFirstMock },
    document: { findFirst: documentFindFirstMock },
    $transaction: transactionMock,
  },
}));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
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
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    obligationFindFirstMock.mockReset().mockResolvedValue({ id: "obligation-1", clientId: "client-1" });
    documentFindFirstMock.mockReset().mockResolvedValue({ id: "document-1" });
    evidenceCreateMock.mockReset().mockImplementation(async ({ data }) => ({ id: "evidence-1", ...data }));
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    transactionMock.mockReset().mockImplementation((callback) => callback({
      complianceEvidence: { create: evidenceCreateMock },
      complianceActivity: { create: activityCreateMock },
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
    expect(evidenceCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceReference: "Registry receipt R-104",
        validThrough: new Date("2027-03-14T23:59:59.999Z"),
      }),
    }));
  });

  it("requires the document to belong to the same client and workspace", async () => {
    documentFindFirstMock.mockResolvedValue(null);
    const response = await attachEvidence(request({
      documentId: "outside-document",
      evidenceClass: "E1",
    }), { params: Promise.resolve({ id: "obligation-1" }) });

    expect(response.status).toBe(404);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
