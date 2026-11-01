import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { GET as listEngagements, POST as createEngagement } from "@/app/api/engagements/route";

const { getWorkspaceContextMock, listByWorkspaceMock, createMock } = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  listByWorkspaceMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/engagement-repository", () => ({
  engagementRepository: { listByWorkspace: listByWorkspaceMock },
}));
vi.mock("@/lib/services/engagement-service", () => ({
  engagementService: { create: createMock },
}));

const principal: WorkspacePrincipal = {
  userId: "staff-1",
  organizationId: "org-a",
  workspaceId: "workspace-a",
  role: "owner",
  permissions: ["engagement:read", "engagement:write"],
};
const createRequest = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/engagements", {
  method: "POST",
  headers: { origin, "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("workspace Engagement endpoints", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal, activeWorkspace: true });
    listByWorkspaceMock.mockReset().mockResolvedValue([]);
    createMock.mockReset().mockResolvedValue({ id: "engagement-a", service: "Formation support", status: "DRAFT" });
  });

  it("does not query engagement records before authentication", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: null, principal: null });
    const response = await listEngagements(new Request("http://localhost/api/engagements"));
    expect(response.status).toBe(401);
    expect(listByWorkspaceMock).not.toHaveBeenCalled();
  });

  it("requires engagement read permission and validates status filters", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal: { ...principal, permissions: ["workspace:read"] } });
    const forbidden = await listEngagements(new Request("http://localhost/api/engagements"));
    expect(forbidden.status).toBe(403);
    expect(listByWorkspaceMock).not.toHaveBeenCalled();

    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal });
    const invalid = await listEngagements(new Request("http://localhost/api/engagements?status=IMAGINARY"));
    expect(invalid.status).toBe(422);
    expect(listByWorkspaceMock).not.toHaveBeenCalled();
  });

  it("passes the principal and validated filters into the scoped list repository", async () => {
    const response = await listEngagements(new Request("http://localhost/api/engagements?status=INTAKE&q=%20formation%20"));
    expect(response.status).toBe(200);
    expect(listByWorkspaceMock).toHaveBeenCalledWith(principal, { status: "INTAKE", query: "formation" });
  });

  it("rejects cross-origin creation requests", async () => {
    const response = await createEngagement(createRequest({ clientId: "client-a", service: "Formation support" }, "https://attacker.example"));
    expect(response.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("blocks writes without engagement permission and prevents caller-supplied lifecycle state", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal: { ...principal, permissions: ["engagement:read"] } });
    const forbidden = await createEngagement(createRequest({ clientId: "client-a", service: "Formation support" }));
    expect(forbidden.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();

    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal });
    const invalid = await createEngagement(createRequest({ clientId: "client-a", service: "Formation support", status: "ACTIVE", workspaceId: "workspace-b" }));
    expect(invalid.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates an engagement using only validated caller input", async () => {
    const response = await createEngagement(createRequest({ clientId: "client-a", service: "Formation support", nextAction: "Confirm documents" }));
    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      clientId: "client-a",
      service: "Formation support",
      nextAction: "Confirm documents",
    }, principal);
  });
});
