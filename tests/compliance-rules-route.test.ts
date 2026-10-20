import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/compliance/rules/route";

const { getWorkspaceContextMock, authorizedTransactionMock, findManyMock } = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({
  getWorkspaceContext: getWorkspaceContextMock,
}));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));

const principal = {
  userId: "reviewer-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "advisor",
  permissions: ["compliance:read"],
};

describe("canonical compliance-rule read boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal });
    findManyMock.mockResolvedValue([]);
    authorizedTransactionMock.mockImplementation(async (_principal, _permission, callback) =>
      callback({ complianceRule: { findMany: findManyMock } }),
    );
  });

  it("revalidates authorization in the transaction and scopes rules to the active workspace", async () => {
    const response = await GET();
    const payload = await response.json() as { data: unknown[]; notice: string };
    expect(response.status).toBe(200);
    expect(authorizedTransactionMock).toHaveBeenCalledWith(principal, "compliance:read", expect.any(Function));
    expect(findManyMock).toHaveBeenCalledWith({
      where: { organizationId: "org-1", workspaceId: "workspace-1" },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      orderBy: [{ active: "desc" }, { ruleKey: "asc" }],
    });
    expect(payload.data).toEqual([]);
    expect(payload.notice).toContain("does not mean no obligations exist");
  });

  it("returns an evidence-lead caveat when rules are present", async () => {
    findManyMock.mockResolvedValueOnce([{ id: "rule-1" }]);
    const response = await GET();
    const payload = await response.json() as { data: unknown[]; notice: string };
    expect(payload.data).toHaveLength(1);
    expect(payload.notice).toContain("not legal conclusions");
  });

  it("fails closed if workspace authorization became stale", async () => {
    authorizedTransactionMock.mockRejectedValueOnce(new Error("WORKSPACE_AUTHORIZATION_STALE"));
    const response = await GET();
    expect(response.status).toBe(409);
  });
  
  it("rejects unauthenticated requests before opening a transaction", async () => {
    getWorkspaceContextMock.mockResolvedValueOnce({ userId: null, principal: null });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("requires an active workspace before opening a transaction", async () => {
    getWorkspaceContextMock.mockResolvedValueOnce({ userId: principal.userId, principal: null });
    const response = await GET();
    expect(response.status).toBe(409);
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("denies callers without compliance read permission", async () => {
    getWorkspaceContextMock.mockResolvedValueOnce({
      userId: principal.userId,
      principal: { ...principal, permissions: ["workspace:read"] },
    });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("returns a generic server error when listing fails unexpectedly", async () => {
    authorizedTransactionMock.mockRejectedValueOnce(new Error("database internals must not leak"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await GET();
      const payload = await response.json() as { error: string };
      expect(response.status).toBe(500);
      expect(payload.error).toBe("Unable to list compliance rules.");
      expect(JSON.stringify(payload)).not.toContain("database internals");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
