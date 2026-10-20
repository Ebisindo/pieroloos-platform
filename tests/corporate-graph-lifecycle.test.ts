import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

const {
  getWorkspaceContextMock,
  hasInvalidRequestOriginMock,
  authorizedTransactionMock,
  directAuditFindManyMock,
  txNodeFindFirstMock,
  txNodeUpdateMock,
  txEdgeFindManyMock,
  txEdgeFindFirstMock,
  txEdgeUpdateMock,
  txEdgeUpdateManyMock,
  txAuditCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  directAuditFindManyMock: vi.fn(),
  txNodeFindFirstMock: vi.fn(),
  txNodeUpdateMock: vi.fn(),
  txEdgeFindManyMock: vi.fn(),
  txEdgeFindFirstMock: vi.fn(),
  txEdgeUpdateMock: vi.fn(),
  txEdgeUpdateManyMock: vi.fn(),
  txAuditCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({
  getWorkspaceContext: getWorkspaceContextMock,
}));
vi.mock("@/lib/auth/request-origin", () => ({
  hasInvalidRequestOrigin: hasInvalidRequestOriginMock,
}));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    corporateGraphAuditEvent: { findMany: directAuditFindManyMock },
  },
}));

const owner: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["workspace:read", "engagement:write"],
};

const transaction = {
  corporateGraphNode: {
    findFirst: txNodeFindFirstMock,
    update: txNodeUpdateMock,
  },
  corporateGraphEdge: {
    findMany: txEdgeFindManyMock,
    findFirst: txEdgeFindFirstMock,
    update: txEdgeUpdateMock,
    updateMany: txEdgeUpdateManyMock,
  },
  corporateGraphAuditEvent: {
    create: txAuditCreateMock,
    findMany: directAuditFindManyMock,
  },
};

import { PATCH as updateNode, DELETE as archiveNode } from "@/app/api/corporate-graph/nodes/[id]/route";
import { DELETE as archiveEdge } from "@/app/api/corporate-graph/edges/[id]/route";
import { GET as getGraphAudit } from "@/app/api/corporate-graph/audit/route";

function mutationRequest(path: string, method: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { origin: "http://localhost", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const nodeContext = { params: Promise.resolve({ id: "node-1" }) };
const edgeContext = { params: Promise.resolve({ id: "edge-1" }) };

describe("corporate graph lifecycle authorization and audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceContextMock.mockResolvedValue({ userId: owner.userId, principal: owner });
    hasInvalidRequestOriginMock.mockReturnValue(false);
    authorizedTransactionMock.mockImplementation(async (_principal, _permission, operation) => operation(transaction));
    directAuditFindManyMock.mockResolvedValue([]);
    txNodeFindFirstMock.mockResolvedValue({ id: "node-1", name: "Holding Ltd", nodeType: "COMPANY" });
    txNodeUpdateMock.mockResolvedValue({ id: "node-1", name: "Updated Holding Ltd" });
    txEdgeFindManyMock.mockResolvedValue([]);
    txEdgeFindFirstMock.mockResolvedValue({
      id: "edge-1",
      relation: "OWNS",
      fromNodeId: "node-1",
      toNodeId: "node-2",
    });
    txEdgeUpdateMock.mockResolvedValue({ id: "edge-1", archivedAt: new Date("2026-01-01T00:00:00Z") });
    txEdgeUpdateManyMock.mockResolvedValue({ count: 0 });
    txAuditCreateMock.mockResolvedValue({ id: "audit-1" });
  });

  it("requires a workspace write permission before editing", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: owner.userId,
      principal: { ...owner, permissions: ["workspace:read"] },
    });

    const response = await updateNode(
      mutationRequest("/api/corporate-graph/nodes/node-1", "PATCH", { name: "Renamed Ltd" }),
      nodeContext,
    );

    expect(response.status).toBe(403);
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("updates only an active node in the authenticated workspace and records the change", async () => {
    const response = await updateNode(
      mutationRequest("/api/corporate-graph/nodes/node-1", "PATCH", { name: "Renamed Ltd" }),
      nodeContext,
    );

    expect(response.status).toBe(200);
    expect(txNodeFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "node-1",
        organizationId: "org-1",
        workspaceId: "workspace-1",
        archivedAt: null,
      },
    }));
    expect(txNodeUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "node-1" },
      data: expect.objectContaining({ name: "Renamed Ltd" }),
    }));
    expect(txAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "NODE_UPDATED",
        subjectId: "node-1",
        actorUserId: "user-1",
      }),
    }));
  });

  it("archives a node and its active connected edges without hard deletion", async () => {
    txEdgeFindManyMock.mockResolvedValue([{
      id: "edge-1",
      fromNodeId: "node-1",
      toNodeId: "node-2",
      relation: "OWNS",
    }]);

    const response = await archiveNode(
      mutationRequest("/api/corporate-graph/nodes/node-1", "DELETE"),
      nodeContext,
    );
    const payload = await response.json() as { data: { archivedRelationshipCount: number } };

    expect(response.status).toBe(200);
    expect(payload.data.archivedRelationshipCount).toBe(1);
    expect(txEdgeUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        archivedAt: null,
        id: { in: ["edge-1"] },
      }),
      data: expect.objectContaining({ archivedByUserId: "user-1" }),
    }));
    expect(txNodeUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "node-1" },
      data: expect.objectContaining({ archivedByUserId: "user-1" }),
    }));
    expect(txAuditCreateMock).toHaveBeenCalledTimes(2);
    expect(txAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "NODE_ARCHIVED", subjectId: "node-1" }),
    }));
    expect(txAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "EDGE_ARCHIVED", subjectId: "edge-1" }),
    }));
  });

  it("archives a relationship and records its audit event", async () => {
    const response = await archiveEdge(
      mutationRequest("/api/corporate-graph/edges/edge-1", "DELETE"),
      edgeContext,
    );

    expect(response.status).toBe(200);
    expect(txEdgeFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "edge-1",
        organizationId: "org-1",
        workspaceId: "workspace-1",
        archivedAt: null,
      },
    }));
    expect(txEdgeUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "edge-1" },
      data: expect.objectContaining({ archivedByUserId: "user-1" }),
    }));
    expect(txAuditCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "EDGE_ARCHIVED", subjectId: "edge-1" }),
    }));
  });

  it("scopes audit history to the active workspace and limits the result set", async () => {
    const response = await getGraphAudit();
    expect(response.status).toBe(200);
    expect(directAuditFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-1", workspaceId: "workspace-1" },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }));
  });

  it("does not permit a cross-origin archive mutation", async () => {
    hasInvalidRequestOriginMock.mockReturnValue(true);

    const response = await archiveNode(
      mutationRequest("/api/corporate-graph/nodes/node-1", "DELETE"),
      nodeContext,
    );

    expect(response.status).toBe(403);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });
});
