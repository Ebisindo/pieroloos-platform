import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const {
  getWorkspaceContextMock,
  invalidOriginMock,
  enforceRateLimitMock,
  createGrantMock,
  setVisibilityMock,
  createInteractionMock,
  reviewSubmissionMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  invalidOriginMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  createGrantMock: vi.fn(),
  setVisibilityMock: vi.fn(),
  createInteractionMock: vi.fn(),
  reviewSubmissionMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: invalidOriginMock }));
vi.mock("@/lib/http/rate-limit", () => ({
  enforceRateLimit: enforceRateLimitMock,
  CLIENT_PORTAL_STAFF_MUTATION_LIMIT: { name: "test-client-portal-staff-mutation", limit: 30, windowMs: 60_000 },
}));
vi.mock("@/lib/services/client-portal-service", () => ({
  createClientPortalGrant: createGrantMock,
  listClientPortalGrants: vi.fn(),
  setClientPortalTaskVisibility: setVisibilityMock,
  createWorkspaceClientPortalInteraction: createInteractionMock,
  reviewClientPortalCompletionSubmission: reviewSubmissionMock,
  listWorkspaceClientPortalInteractions: vi.fn(),
}));

import { POST as grantPortalAccess } from "@/app/api/clients/[clientId]/portal-access/route";
import { PATCH as setPortalVisibility } from "@/app/api/clients/[clientId]/portal-visibility/route";
import { POST as createStaffInteraction } from "@/app/api/clients/[clientId]/portal-interactions/route";
import { PATCH as reviewSubmission } from "@/app/api/clients/[clientId]/portal-interactions/[interactionId]/route";

const principal = {
  userId: "staff-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["client:read", "client:write"],
};

const grantParams = { params: Promise.resolve({ clientId: "client-1" }) };
const interactionParams = { params: Promise.resolve({ clientId: "client-1", interactionId: "interaction-1" }) };

function post(path: string, body: string, origin = "http://localhost") {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });
}

function patch(path: string, body: string, origin = "http://localhost") {
  return new Request(`http://localhost${path}`, {
    method: "PATCH",
    headers: { origin, "content-type": "application/json" },
    body,
  });
}

const cases = [
  {
    name: "client portal grant",
    call: (body: string) => grantPortalAccess(post("/api/clients/client-1/portal-access", body), grantParams),
    sideEffect: createGrantMock,
    body: JSON.stringify({ email: "client@example.com" }),
  },
  {
    name: "portal visibility",
    call: (body: string) => setPortalVisibility(patch("/api/clients/client-1/portal-visibility", body), grantParams),
    sideEffect: setVisibilityMock,
    body: JSON.stringify({ resourceType: "TASK", resourceId: "task-1", visible: true }),
  },
  {
    name: "staff portal interaction",
    call: (body: string) => createStaffInteraction(post("/api/clients/client-1/portal-interactions", body), grantParams),
    sideEffect: createInteractionMock,
    body: JSON.stringify({ kind: "MESSAGE", content: "Please review this task." }),
  },
  {
    name: "portal submission review",
    call: (body: string) => reviewSubmission(patch("/api/clients/client-1/portal-interactions/interaction-1", body), interactionParams),
    sideEffect: reviewSubmissionMock,
    body: JSON.stringify({ decision: "ACCEPTED" }),
  },
];

describe("staff client-portal mutation request guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal });
    invalidOriginMock.mockReturnValue(false);
    enforceRateLimitMock.mockResolvedValue(null);
    createGrantMock.mockResolvedValue({ id: "grant-1" });
    setVisibilityMock.mockResolvedValue({ id: "task-1", portalVisible: true });
    createInteractionMock.mockResolvedValue({ id: "interaction-1" });
    reviewSubmissionMock.mockResolvedValue({ id: "interaction-1", status: "ACCEPTED" });
  });

  it.each(cases)("rejects oversized JSON before service side effects for $name", async (testCase) => {
    const tooLarge = JSON.stringify({ content: "x".repeat(25 * 1024) });
    const response = await testCase.call(tooLarge);
    expect(response.status).toBe(413);
    expect(testCase.sideEffect).not.toHaveBeenCalled();
  });

  it.each(cases)("honors the staff mutation rate limit for $name", async (testCase) => {
    enforceRateLimitMock.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests." }, { status: 429 }),
    );
    const response = await testCase.call(testCase.body);
    expect(response.status).toBe(429);
    expect(testCase.sideEffect).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutations before resolving workspace context", async () => {
    invalidOriginMock.mockReturnValue(true);
    const response = await grantPortalAccess(
      post("/api/clients/client-1/portal-access", JSON.stringify({ email: "client@example.com" }), "https://attacker.example"),
      grantParams,
    );
    expect(response.status).toBe(403);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
    expect(createGrantMock).not.toHaveBeenCalled();
  });
});
