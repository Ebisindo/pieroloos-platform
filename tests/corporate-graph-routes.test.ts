import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

const {
  getWorkspaceContextMock,
  graphNodeFindManyMock,
  graphEdgeFindManyMock,
  complianceRuleFindManyMock,
  authorizedTransactionMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  graphNodeFindManyMock: vi.fn(),
  graphEdgeFindManyMock: vi.fn(),
  complianceRuleFindManyMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({
  getWorkspaceContext: getWorkspaceContextMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    corporateGraphNode: { findMany: graphNodeFindManyMock },
    corporateGraphEdge: { findMany: graphEdgeFindManyMock },
    corporateComplianceRule: { findMany: complianceRuleFindManyMock },
  },
}));

vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));

import { GET as getGraph } from "@/app/api/corporate-graph/route";
import { POST as createGraphNode } from "@/app/api/corporate-graph/nodes/route";
import { POST as createGraphEdge } from "@/app/api/corporate-graph/edges/route";
import { GET as getComplianceRules } from "@/app/api/compliance/rules/route";

const ownerPrincipal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["workspace:read", "compliance:read", "engagement:write"],
};

const validNodeId = "cmvaw9fle000y0cee1on7l16t";
const secondNodeId = "cmvaw9flf00100ceef308yaq2";

function writeRequest(path: string, body: unknown, origin = "http://localhost") {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("corporate graph and compliance API boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceContextMock.mockResolvedValue({
      userId: ownerPrincipal.userId,
      principal: ownerPrincipal,
    });
    graphNodeFindManyMock.mockResolvedValue([]);
    graphEdgeFindManyMock.mockResolvedValue([]);
    complianceRuleFindManyMock.mockResolvedValue([]);
  });

  it("rejects unauthenticated graph reads before querying data", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: null, principal: null });

    const response = await getGraph();

    expect(response.status).toBe(401);
    expect(graphNodeFindManyMock).not.toHaveBeenCalled();
    expect(graphEdgeFindManyMock).not.toHaveBeenCalled();
  });

  it("denies graph reads without workspace read permission", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: ownerPrincipal.userId,
      principal: { ...ownerPrincipal, permissions: [] },
    });

    const response = await getGraph();

    expect(response.status).toBe(403);
    expect(graphNodeFindManyMock).not.toHaveBeenCalled();
    expect(graphEdgeFindManyMock).not.toHaveBeenCalled();
  });

  it("scopes both graph queries to the active organization and workspace", async () => {
    graphNodeFindManyMock.mockResolvedValue([{ id: "node-1", name: "Example Ltd" }]);
    graphEdgeFindManyMock.mockResolvedValue([]);

    const response = await getGraph();

    expect(response.status).toBe(200);
    expect(graphNodeFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-1", workspaceId: "workspace-1" },
      take: 250,
    }));
    expect(graphEdgeFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-1", workspaceId: "workspace-1" },
      take: 500,
    }));
  });

  it("reports an empty compliance registry as unknown, not as proof of no obligations", async () => {
    const response = await getComplianceRules(
      new Request("http://localhost/api/compliance/rules?jurisdiction=NG&entityType=COMPANY"),
    );
    const payload = await response.json() as { notice: string; rules: unknown[] };

    expect(response.status).toBe(200);
    expect(complianceRuleFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        jurisdictionCode: "NG",
        entityType: { equals: "COMPANY", mode: "insensitive" },
      }),
    }));
    expect(payload.rules).toEqual([]);
    expect(payload.notice).toContain("This does not mean no obligations exist.");
  });

  it("rejects ownership percentages on non-ownership relationships before a database transaction", async () => {
    const response = await createGraphEdge(writeRequest("/api/corporate-graph/edges", {
      fromNodeId: validNodeId,
      toNodeId: secondNodeId,
      relation: "BANKS_WITH",
      ownershipPercent: 25,
    }));

    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("only valid for OWNS");
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects entity creation for a principal without entity-design permission", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: ownerPrincipal.userId,
      principal: { ...ownerPrincipal, permissions: ["workspace:read"] },
    });

    const response = await createGraphNode(writeRequest("/api/corporate-graph/nodes", {
      name: "Example Holdings",
      nodeType: "COMPANY",
      entityType: "COMPANY",
    }));

    expect(response.status).toBe(403);
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin relationship writes before resolving a session", async () => {
    const response = await createGraphEdge(writeRequest(
      "/api/corporate-graph/edges",
      { fromNodeId: validNodeId, toNodeId: secondNodeId, relation: "OWNS" },
      "https://attacker.example",
    ));

    expect(response.status).toBe(403);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });
});
