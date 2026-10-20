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
});
