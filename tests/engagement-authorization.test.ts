import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { GET as getEngagement } from "@/app/api/engagements/[id]/route";
import { GET as getActivities, POST as createActivity } from "@/app/api/engagements/[id]/activities/route";

const {
  getWorkspaceContextMock,
  findEngagementMock,
  listActivitiesMock,
  createActivityMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  findEngagementMock: vi.fn(),
  listActivitiesMock: vi.fn(),
  createActivityMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/engagement-repository", () => ({
  engagementRepository: { findById: findEngagementMock },
}));
vi.mock("@/lib/db/activity-repository", () => ({
  activityRepository: { listByEngagement: listActivitiesMock },
}));
vi.mock("@/lib/services/activity-service", () => ({
  activityService: { create: createActivityMock },
}));

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["engagement:read", "engagement:write"],
};

const params = { params: Promise.resolve({ id: "engagement-secret-id" }) };

describe("engagement resource authorization", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    findEngagementMock.mockReset().mockResolvedValue({ id: "engagement-secret-id", activities: [] });
    listActivitiesMock.mockReset().mockResolvedValue([]);
    createActivityMock.mockReset().mockResolvedValue({ id: "activity-1" });
  });

  it("scopes ID-based reads to the active workspace", async () => {
    const response = await getEngagement(new Request("http://localhost"), params);
    expect(response.status).toBe(200);
    expect(findEngagementMock).toHaveBeenCalledWith("engagement-secret-id", principal);
  });

  it("does not query a resource ID for unauthenticated callers", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: null, principal: null });
    const response = await getEngagement(new Request("http://localhost"), params);
    expect(response.status).toBe(401);
    expect(findEngagementMock).not.toHaveBeenCalled();
  });

  it("checks engagement ownership before reading activity by ID", async () => {
    findEngagementMock.mockResolvedValue(null);
    const response = await getActivities(new Request("http://localhost"), params);
    expect(response.status).toBe(404);
    expect(findEngagementMock).toHaveBeenCalledWith("engagement-secret-id", principal);
    expect(listActivitiesMock).not.toHaveBeenCalled();
  });

  it("binds activity creation to the path resource and authenticated principal", async () => {
    const response = await createActivity(new Request("http://localhost/api/engagements/engagement-secret-id/activities", {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "application/json" },
      body: JSON.stringify({
        type: "COMMENTED",
        title: "Progress note",
        engagementId: "other-engagement",
        workspaceId: "other-workspace",
        actorId: "other-user",
      }),
    }), params);

    expect(response.status).toBe(201);
    expect(createActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ engagementId: "engagement-secret-id" }),
      principal,
    );
    const input = createActivityMock.mock.calls[0][0];
    expect(input.workspaceId).toBeUndefined();
    expect(input.actorId).toBeUndefined();
  });
});
