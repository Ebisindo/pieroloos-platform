import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/business-intent/proposals/route";

const {
  getWorkspaceContextMock,
  invalidOriginMock,
  transactionMock,
  entitlementMock,
  rateLimitMock,
  documentFindManyMock,
  proposalCreateMock,
  billingCreateMock,
  activityCreateMock,
  analyzeMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  invalidOriginMock: vi.fn(),
  transactionMock: vi.fn(),
  entitlementMock: vi.fn(),
  rateLimitMock: vi.fn(),
  documentFindManyMock: vi.fn(),
  proposalCreateMock: vi.fn(),
  billingCreateMock: vi.fn(),
  activityCreateMock: vi.fn(),
  analyzeMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: invalidOriginMock }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({ withAuthorizedWorkspaceTransaction: transactionMock }));
vi.mock("@/lib/http/rate-limit", () => ({ enforceRateLimit: rateLimitMock }));
vi.mock("@/lib/services/business-intent-entitlement", () => ({
  assertBusinessIntentEntitlement: entitlementMock,
  BUSINESS_INTENT_ENTITLEMENT_KEY: "business-intent",
}));
vi.mock("@/lib/services/business-intent-provider", () => ({
  analyzeBusinessIntent: analyzeMock,
  BusinessIntentProviderError: class BusinessIntentProviderError extends Error {
    kind = "UNAVAILABLE";
  },
}));

const principal = {
  userId: "owner-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["formation:write"],
};

const sourceDocument = {
  id: "document-1",
  name: "Reviewed source.pdf",
  checksum: "sha256:source-v1",
  version: 1,
  updatedAt: new Date("2026-10-18T10:00:00.000Z"),
};

const analysis = {
  provider: "openai" as const,
  model: "test-model",
  proposal: {
    businessSummary: "A provisional business structure.",
    assumptions: ["The business has demand in its target market."],
    missingFacts: ["Confirm jurisdiction-specific requirements."],
    complexity: "UNCERTAIN" as const,
    complexityRationale: "Important source facts require further verification.",
    jurisdictionComparisonCriteria: ["Verified legal requirements."],
    proposedEntities: [{
      key: "operating_company",
      label: "Potential operating company",
      category: "LEGAL_ENTITY" as const,
      jurisdictionSuggestion: null,
      purpose: "Potentially contract with customers.",
      rationale: "Requires evidence and qualified review.",
    }],
    proposedRelationships: [],
    riskScenarios: [],
    evidenceGaps: ["No legal source has been independently checked."],
    uncertaintyNotes: ["This is not a legal conclusion."],
    advisorBrief: "Obtain qualified professional review before operational action.",
  },
};

const input = {
  businessName: "Example Logistics",
  businessObjective: "Provide regional freight and logistics services.",
  homeJurisdiction: "Nigeria",
  knownFacts: [{
    id: "document-1",
    statement: "User claim that must remain unverified.",
    sourceUrl: "https://user-supplied.example/source",
    evidenceClass: "E1",
  }],
};

function request(body: unknown = input) {
  return new Request("http://localhost/api/ai/business-intent/proposals", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("server-controlled business-intent evidence binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal });
    invalidOriginMock.mockReturnValue(false);
    rateLimitMock.mockResolvedValue(null);
    entitlementMock.mockResolvedValue(undefined);
    analyzeMock.mockResolvedValue(analysis);
    documentFindManyMock.mockResolvedValue([sourceDocument]);
    proposalCreateMock.mockResolvedValue({
      id: "proposal-1", status: "PROPOSED", version: 1, evidenceReferences: [],
    });
    billingCreateMock.mockResolvedValue({ id: "usage-1" });
    activityCreateMock.mockResolvedValue({ id: "activity-1" });
    transactionMock.mockImplementation(async (_principal, _permission, callback) => callback({
      client: { findFirst: vi.fn().mockResolvedValue({ id: "client-1" }) },
      document: { findMany: documentFindManyMock },
      businessIntentProposal: { create: proposalCreateMock },
      billingUsageEvent: { create: billingCreateMock },
      activity: { create: activityCreateMock },
    }));
  });

  it("resolves all document IDs in the active workspace before invoking the provider", async () => {
    documentFindManyMock.mockResolvedValueOnce([]);
    const response = await POST(request());
    expect(response.status).toBe(422);
    expect(analyzeMock).not.toHaveBeenCalled();
    expect(proposalCreateMock).not.toHaveBeenCalled();
    expect(documentFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ["document-1"] },
        workspaceId: "workspace-1",
        clientId: null,
        status: "AVAILABLE",
        scanStatus: "CLEAN",
        reviewStatus: "VERIFIED",
        deletedAt: null,
      }),
    }));
  });

  it("does not send caller-supplied URL or claimed provenance to the provider", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(analyzeMock).toHaveBeenCalledTimes(1);
    const providerInput = analyzeMock.mock.calls[0]?.[0];
    expect(providerInput.knownFacts).toEqual([{
      id: "document-1",
      statement: "User claim that must remain unverified.",
      evidenceClass: "E1",
    }]);
    expect(providerInput.knownFacts[0]).not.toHaveProperty("sourceUrl");
    expect(documentFindManyMock).toHaveBeenCalledTimes(2);
  });

  it("rejects evidence that changes or becomes unavailable while the provider runs", async () => {
    documentFindManyMock
      .mockResolvedValueOnce([sourceDocument])
      .mockResolvedValueOnce([{ ...sourceDocument, checksum: "sha256:source-v2", version: 2 }]);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(analyzeMock).toHaveBeenCalledTimes(1);
    expect(proposalCreateMock).not.toHaveBeenCalled();
    expect(billingCreateMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });
});
