import { beforeEach, describe, expect, it, vi } from "vitest";

const { contextMock, overviewMock, listMock, uploadMock } = vi.hoisted(() => ({
  contextMock: vi.fn(),
  overviewMock: vi.fn(),
  listMock: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock("@/lib/auth/client-portal-context", () => ({ getClientPortalContext: contextMock }));
vi.mock("@/lib/services/client-portal-service", () => ({
  getClientPortalOverview: overviewMock,
  listClientPortalDocuments: listMock,
  createClientPortalDocumentDownloadUrl: vi.fn(),
}));
vi.mock("@/lib/services/document-storage-service", () => ({ uploadClientPortalEvidence: uploadMock }));
vi.mock("@/lib/http/document-upload", () => ({ parseDocumentUpload: vi.fn() }));

import { GET as getOverview } from "@/app/api/portal/clients/[clientId]/route";
import { GET as listDocuments, POST as uploadDocument } from "@/app/api/portal/clients/[clientId]/documents/route";
import { InMemoryRateLimitStore, enforceRateLimit, setRateLimitStore } from "@/lib/http/rate-limit";

const params = { params: Promise.resolve({ clientId: "client-1" }) };
const principal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "ws-1",
  clientId: "client-1",
  clientPortalGrantId: "grant-1",
};
const grant = (overrides = {}) => ({ id: "grant-1", canViewStatus: true, canUploadEvidence: true, ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  setRateLimitStore(new InMemoryRateLimitStore());
});

describe("client portal route authorization", () => {
  it("rejects unauthenticated requests", async () => {
    contextMock.mockResolvedValue({ userId: null, selectedGrant: null, principal: null });
    expect((await getOverview(new Request("http://localhost/x"), params)).status).toBe(401);
    expect(overviewMock).not.toHaveBeenCalled();
  });

  it("hides clients the user holds no grant for", async () => {
    contextMock.mockResolvedValue({ userId: "user-1", selectedGrant: null, principal: null });
    expect((await getOverview(new Request("http://localhost/x"), params)).status).toBe(404);
    expect((await listDocuments(new Request("http://localhost/x"), params)).status).toBe(404);
    expect(overviewMock).not.toHaveBeenCalled();
    expect(listMock).not.toHaveBeenCalled();
  });

  it("enforces capability flags", async () => {
    contextMock.mockResolvedValue({ userId: "user-1", selectedGrant: grant({ canViewStatus: false }), principal });
    expect((await getOverview(new Request("http://localhost/x"), params)).status).toBe(403);

    contextMock.mockResolvedValue({ userId: "user-1", selectedGrant: grant({ canUploadEvidence: false }), principal });
    const upload = await uploadDocument(
      new Request("http://localhost/x", { method: "POST", headers: { origin: "http://localhost" } }),
      params,
    );
    expect(upload.status).toBe(403);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("maps a revoked or expired grant to 403", async () => {
    contextMock.mockResolvedValue({ userId: "user-1", selectedGrant: grant(), principal });
    overviewMock.mockRejectedValue(new Error("CLIENT_PORTAL_ACCESS_REVOKED"));
    expect((await getOverview(new Request("http://localhost/x"), params)).status).toBe(403);
  });

  it("rejects cross-origin uploads before authenticating", async () => {
    const response = await uploadDocument(
      new Request("http://localhost/x", { method: "POST", headers: { origin: "https://evil.example" } }),
      params,
    );
    expect(response.status).toBe(403);
    expect(contextMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated portal reads with Retry-After", async () => {
    contextMock.mockResolvedValue({ userId: "user-1", selectedGrant: grant(), principal });
    overviewMock.mockResolvedValue({});
    let last = await getOverview(new Request("http://localhost/x"), params);
    for (let i = 0; i < 120; i += 1) last = await getOverview(new Request("http://localhost/x"), params);
    expect(last.status).toBe(429);
    expect(Number(last.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("rate limiter", () => {
  it("isolates subjects and resets after the window", async () => {
    const policy = { name: "t", limit: 1, windowMs: 1000 };
    expect(await enforceRateLimit(policy, "a", 0)).toBeNull();
    expect((await enforceRateLimit(policy, "a", 10))?.status).toBe(429);
    expect(await enforceRateLimit(policy, "b", 10)).toBeNull();
    expect(await enforceRateLimit(policy, "a", 1001)).toBeNull();
  });
});
