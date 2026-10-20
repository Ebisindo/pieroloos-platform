import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  portalContextMock,
  workspaceContextMock,
  createClientInteractionMock,
  listClientInteractionsMock,
  createStaffInteractionMock,
  listStaffInteractionsMock,
  reviewSubmissionMock,
} = vi.hoisted(() => ({
  portalContextMock: vi.fn(),
  workspaceContextMock: vi.fn(),
  createClientInteractionMock: vi.fn(),
  listClientInteractionsMock: vi.fn(),
  createStaffInteractionMock: vi.fn(),
  listStaffInteractionsMock: vi.fn(),
  reviewSubmissionMock: vi.fn(),
}));

vi.mock("@/lib/auth/client-portal-context", () => ({ getClientPortalContext: portalContextMock }));
vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: workspaceContextMock }));
vi.mock("@/lib/services/client-portal-service", () => ({
  createClientPortalInteraction: createClientInteractionMock,
  listClientPortalInteractions: listClientInteractionsMock,
  createWorkspaceClientPortalInteraction: createStaffInteractionMock,
  listWorkspaceClientPortalInteractions: listStaffInteractionsMock,
  reviewClientPortalCompletionSubmission: reviewSubmissionMock,
}));

import { GET as getClientInteractions, POST as postClientInteraction } from "@/app/api/portal/clients/[clientId]/interactions/route";
import { GET as getStaffInteractions, POST as postStaffInteraction } from "@/app/api/clients/[clientId]/portal-interactions/route";
import { PATCH as reviewStaffSubmission } from "@/app/api/clients/[clientId]/portal-interactions/[interactionId]/route";
import { InMemoryRateLimitStore, setRateLimitStore } from "@/lib/http/rate-limit";

const params = { params: Promise.resolve({ clientId: "client-1" }) };
const clientPrincipal = {
  userId: "portal-user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  clientId: "client-1",
  clientPortalGrantId: "grant-1",
};
const staffPrincipal = {
  userId: "staff-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  permissions: ["client:read", "client:write"],
};

beforeEach(() => {
  vi.clearAllMocks();
  setRateLimitStore(new InMemoryRateLimitStore());
  portalContextMock.mockResolvedValue({
    userId: clientPrincipal.userId,
    selectedGrant: { id: "grant-1" },
    principal: clientPrincipal,
  });
  workspaceContextMock.mockResolvedValue({ userId: staffPrincipal.userId, principal: staffPrincipal });
});

describe("client portal interaction routes", () => {
  it("requires authenticated grant-scoped client access", async () => {
    portalContextMock.mockResolvedValue({ userId: null, selectedGrant: null, principal: null });
    expect((await getClientInteractions(new Request("http://localhost"), params)).status).toBe(401);

    portalContextMock.mockResolvedValue({ userId: clientPrincipal.userId, selectedGrant: null, principal: null });
    expect((await getClientInteractions(new Request("http://localhost"), params)).status).toBe(404);
    expect(listClientInteractionsMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin mutations and invalid completion payloads", async () => {
    const crossOrigin = await postClientInteraction(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { origin: "https://untrusted.example", "content-type": "application/json" },
        body: JSON.stringify({ kind: "MESSAGE", content: "Hello" }),
      }),
      params,
    );
    expect(crossOrigin.status).toBe(403);
    expect(portalContextMock).not.toHaveBeenCalled();

    const invalid = await postClientInteraction(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { origin: "http://localhost", "content-type": "application/json" },
        body: JSON.stringify({ kind: "COMPLETION_SUBMISSION", content: "Done" }),
      }),
      params,
    );
    expect(invalid.status).toBe(422);
    expect(createClientInteractionMock).not.toHaveBeenCalled();
  });

  it("maps revoked grants on client writes to forbidden", async () => {
    createClientInteractionMock.mockRejectedValue(new Error("CLIENT_PORTAL_ACCESS_REVOKED"));
    const response = await postClientInteraction(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { origin: "http://localhost", "content-type": "application/json" },
        body: JSON.stringify({ kind: "MESSAGE", content: "Hello" }),
      }),
      params,
    );
    expect(response.status).toBe(403);
  });
});

describe("workspace portal interaction routes", () => {
  it("enforces workspace permissions before listing or sending messages", async () => {
    workspaceContextMock.mockResolvedValue({
      userId: staffPrincipal.userId,
      principal: { ...staffPrincipal, permissions: [] },
    });
    expect((await getStaffInteractions(new Request("http://localhost"), params)).status).toBe(403);
    expect((await postStaffInteraction(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { origin: "http://localhost", "content-type": "application/json" },
        body: JSON.stringify({ kind: "MESSAGE", content: "Hello" }),
      }),
      params,
    )).status).toBe(403);
    expect(listStaffInteractionsMock).not.toHaveBeenCalled();
    expect(createStaffInteractionMock).not.toHaveBeenCalled();
  });

  it("requires an explanation when requesting client changes", async () => {
    const response = await reviewStaffSubmission(
      new Request("http://localhost/api", {
        method: "PATCH",
        headers: { origin: "http://localhost", "content-type": "application/json" },
        body: JSON.stringify({ decision: "CHANGES_REQUESTED" }),
      }),
      { params: Promise.resolve({ clientId: "client-1", interactionId: "submission-1" }) },
    );
    expect(response.status).toBe(422);
    expect(reviewSubmissionMock).not.toHaveBeenCalled();
  });
});
