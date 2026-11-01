import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { GET as listBusinessProfiles } from "@/app/api/business-profile/route";
import { GET as getBusinessProfile, PATCH as updateBusinessProfile } from "@/app/api/business-profile/[id]/route";

const { getWorkspaceContextMock, listByWorkspaceMock, findByIdMock, updateMock } = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  listByWorkspaceMock: vi.fn(),
  findByIdMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/business-profile-repository", () => ({
  businessProfileRepository: {
    listByWorkspace: listByWorkspaceMock,
    findById: findByIdMock,
  },
}));
vi.mock("@/lib/services/business-profile-service", () => ({
  businessProfileService: { update: updateMock },
}));

const principal: WorkspacePrincipal = {
  userId: "staff-1",
  organizationId: "org-a",
  workspaceId: "workspace-a",
  role: "owner",
  permissions: ["client:read", "client:write"],
};
const routeContext = { params: Promise.resolve({ id: "profile-a" }) };
const request = (body?: unknown) => new Request("http://localhost/api/business-profile/profile-a", {
  method: "PATCH",
  headers: { origin: "http://localhost", "content-type": "application/json" },
  body: JSON.stringify(body ?? { objective: "Prepare an evidence-backed plan." }),
});

describe("Business Profile workspace authorization", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal, activeWorkspace: true });
    listByWorkspaceMock.mockReset().mockResolvedValue([]);
    findByIdMock.mockReset().mockResolvedValue({ id: "profile-a", clientId: "client-a", version: 2 });
    updateMock.mockReset().mockResolvedValue({ id: "profile-a", version: 3 });
  });

  it("does not query profiles for unauthenticated callers", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: null, principal: null });
    const response = await listBusinessProfiles();
    expect(response.status).toBe(401);
    expect(listByWorkspaceMock).not.toHaveBeenCalled();
  });

  it("rejects reads without client read permission", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: ["workspace:read"] },
      activeWorkspace: true,
    });
    const response = await getBusinessProfile(new Request("http://localhost/api/business-profile/profile-a"), routeContext);
    expect(response.status).toBe(403);
    expect(findByIdMock).not.toHaveBeenCalled();
  });

  it("passes the active workspace principal to profile lookup", async () => {
    const response = await getBusinessProfile(new Request("http://localhost/api/business-profile/profile-a"), routeContext);
    expect(response.status).toBe(200);
    expect(findByIdMock).toHaveBeenCalledWith("profile-a", principal);
  });

  it("rejects profile writes without client write permission", async () => {
    getWorkspaceContextMock.mockResolvedValue({
      userId: principal.userId,
      principal: { ...principal, permissions: ["client:read"] },
      activeWorkspace: true,
    });
    const response = await updateBusinessProfile(request(), routeContext);
    expect(response.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects extra write fields and forwards only validated data", async () => {
    const invalid = await updateBusinessProfile(request({ objective: "Update objectives.", workspaceId: "workspace-b" }), routeContext);
    expect(invalid.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();

    const valid = await updateBusinessProfile(request({ objective: "Update objectives." }), routeContext);
    expect(valid.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith("profile-a", { objective: "Update objectives." }, principal);
  });
});
