import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

const {
  getWorkspaceContextMock,
  graphNodeFindManyMock,
  graphEdgeFindManyMock,
  complianceRuleFindManyMock,
  graphAuditFindManyMock,
  authorizedTransactionMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  graphNodeFindManyMock: vi.fn(),
  graphEdgeFindManyMock: vi.fn(),
  complianceRuleFindManyMock: vi.fn(),
  graphAuditFindManyMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({
  getWorkspaceContext: getWorkspaceContextMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    corporateGraphNode: { findMany: graphNodeFindManyMock },
    corporateGraphEdge: { findMany: graphEdgeFindManyMock },
    complianceRule: { findMany: complianceRuleFindManyMock },
    corporateGraphAuditEvent: { findMany: graphAuditFindManyMock },
  },
}));

vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));

import { GET as getGraph } from "@/app/api/corporate-graph/route";
import { POST as createGraphNode } from "@/app/api/corporate-graph/nodes/route";
import { POST as createGraphEdge } from "@/app/api/corporate-graph/edges/route";
import { GET as getComplianceRules } from "@/app/api/compliance/rules/route";
import { GET as getGraphAudit } from "@/app/api/corporate-graph/audit/route";

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
    authorizedTransactionMock.mockImplementation(async (_principal, _permission, operation) =>
      operation({
        corporateGraphNode: { findMany: graphNodeFindManyMock },
        corporateGraphEdge: { findMany: graphEdgeFindManyMock },
        corporateGraphAuditEvent: { findMany: graphAuditFindManyMock },
        complianceRule: { findMany: complianceRuleFindManyMock },
      }),
    );
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
      where: { organizationId: "org-1", workspaceId: "workspace-1", archivedAt: null },
      take: 250,
    }));
    expect(graphEdgeFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-1", workspaceId: "workspace-1", archivedAt: null },
      take: 500,
    }));
  });

  it("returns the canonical workspace-scoped compliance registry", async () => {
    const response = await getComplianceRules();
    const payload = await response.json() as { data: unknown[] };

    expect(response.status).toBe(200);
    expect(complianceRuleFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        organizationId: "org-1",
        workspaceId: "workspace-1",
      },
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    }));
    expect(payload.data).toEqual([]);
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


describe("corporate graph read authorization revalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceContextMock.mockResolvedValue({
      userId: ownerPrincipal.userId,
      principal: ownerPrincipal,
    });
    graphNodeFindManyMock.mockResolvedValue([]);
    graphEdgeFindManyMock.mockResolvedValue([]);
    graphAuditFindManyMock.mockResolvedValue([]);
    authorizedTransactionMock.mockImplementation(async (_principal, _permission, operation) =>
      operation({
        corporateGraphNode: { findMany: graphNodeFindManyMock },
        corporateGraphEdge: { findMany: graphEdgeFindManyMock },
        corporateGraphAuditEvent: { findMany: graphAuditFindManyMock },
        complianceRule: { findMany: complianceRuleFindManyMock },
      }),
    );
  });

  it("revalidates workspace authorization inside the graph read transaction", async () => {
    const response = await getGraph();
    expect(response.status).toBe(200);
    expect(authorizedTransactionMock).toHaveBeenCalledWith(ownerPrincipal, "workspace:read", expect.any(Function));
  });

  it("returns conflict without querying if graph-read authorization became stale", async () => {
    authorizedTransactionMock.mockRejectedValueOnce(new Error("WORKSPACE_AUTHORIZATION_STALE"));
    const response = await getGraph();
    expect(response.status).toBe(409);
    expect(graphNodeFindManyMock).not.toHaveBeenCalled();
    expect(graphEdgeFindManyMock).not.toHaveBeenCalled();
  });

  it("revalidates workspace authorization inside the graph audit read transaction", async () => {
    const response = await getGraphAudit();
    expect(response.status).toBe(200);
    expect(authorizedTransactionMock).toHaveBeenCalledWith(ownerPrincipal, "workspace:read", expect.any(Function));
  });

  it("returns conflict without querying if graph-audit authorization became stale", async () => {
    authorizedTransactionMock.mockRejectedValueOnce(new Error("WORKSPACE_AUTHORIZATION_STALE"));
    const response = await getGraphAudit();
    expect(response.status).toBe(409);
    expect(graphAuditFindManyMock).not.toHaveBeenCalled();
  });
});
