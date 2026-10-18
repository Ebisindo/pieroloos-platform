import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/business-intent/proposals/route";

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
  hasInvalidRequestOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  authorizedTransaction: vi.fn(),
  assertEntitlement: vi.fn(),
  clientFindFirst: vi.fn(),
  evidenceFindMany: vi.fn(),
  proposalCreate: vi.fn(),
  billingUsageCreate: vi.fn(),
  activityCreate: vi.fn(),
  evidenceReferenceCreate: vi.fn(),
  analyzeBusinessIntent: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: mocks.getWorkspaceContext }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: mocks.hasInvalidRequestOrigin }));
vi.mock("@/lib/http/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: mocks.authorizedTransaction,
}));
vi.mock("@/lib/services/business-intent-entitlement", () => ({
  assertBusinessIntentEntitlement: mocks.assertEntitlement,
  BUSINESS_INTENT_ENTITLEMENT_KEY: "business_intent_analysis",
}));
vi.mock("@/lib/services/business-intent-provider", () => ({
  analyzeBusinessIntent: mocks.analyzeBusinessIntent,
  BusinessIntentProviderError: class BusinessIntentProviderError extends Error {
    constructor(public kind: string, message: string) { super(message); }
  },
}));

const principal = {
  userId: "reviewer-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "advisor",
  permissions: ["formation:write"],
};
const validProposal = {
  businessSummary: "A provisional business plan requiring verification.",
  assumptions: ["Demand exists in the selected market."],
  missingFacts: ["Confirm jurisdiction-specific requirements."],
  complexity: "UNCERTAIN",
  complexityRationale: "Evidence is incomplete and needs independent review.",
  jurisdictionComparisonCriteria: ["Source-verified obligations and cost."],
  proposedEntities: [{
    key: "operating_company",
    label: "Potential operating company",
    category: "LEGAL_ENTITY",
    jurisdictionSuggestion: null,
    purpose: "Potentially contract with customers if appropriate.",
    rationale: "Requires evidence and professional review.",
  }],
  proposedRelationships: [],
  riskScenarios: [],
  evidenceGaps: ["No verified statutory source was attached."],
  uncertaintyNotes: ["This is a planning hypothesis, not a legal conclusion."],
  advisorBrief: "Verify the facts before taking operational action.",
};
function request(knownFacts: unknown[], clientId?: string) {
  return new Request("http://localhost/api/ai/business-intent/proposals", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      ...(clientId ? { clientId } : {}),
      businessName: "Example Logistics",
      businessObjective: "Provide reliable regional freight and logistics services.",
      homeJurisdiction: "Nigeria",
      knownFacts,
    }),
  });
}
function evidence(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, title: "Official registry record", source: "https://registry.example.gov/source",
    sourceType: "OFFICIAL_REGISTRY", publicationDate: null,
    retrievedAt: new Date("2026-10-18T10:00:00.000Z"), evidenceClass: "E3",
    reviewStatus: "VERIFIED", jurisdictionId: "jurisdiction-1",
    documents: [{ id: "document-1", clientId: "client-1", workspaceId: "workspace-1", checksum: "abc123" }],
    ...overrides,
  };
}

describe("business-intent trusted evidence binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PIEROLOOS_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.PIEROLOOS_AI_MODEL = "test-model";
    mocks.getWorkspaceContext.mockResolvedValue({ userId: principal.userId, principal });
    mocks.hasInvalidRequestOrigin.mockReturnValue(false);
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.assertEntitlement.mockResolvedValue(undefined);
    mocks.clientFindFirst.mockResolvedValue({ id: "client-1" });
    mocks.evidenceFindMany.mockResolvedValue([]);
    mocks.proposalCreate.mockResolvedValue({ id: "proposal-1", workspaceId: principal.workspaceId, status: "PROPOSED", version: 1 });
    mocks.billingUsageCreate.mockResolvedValue({ id: "usage-1" });
    mocks.activityCreate.mockResolvedValue({ id: "activity-1" });
    mocks.evidenceReferenceCreate.mockResolvedValue({ id: "reference-1" });
    mocks.analyzeBusinessIntent.mockResolvedValue({ proposal: validProposal, provider: "openai", model: "test-model" });
    mocks.authorizedTransaction.mockImplementation(async (_principal, _permission, callback) => callback({
      client: { findFirst: mocks.clientFindFirst },
      evidence: { findMany: mocks.evidenceFindMany },
      businessIntentProposal: { create: mocks.proposalCreate },
      businessIntentEvidenceReference: { create: mocks.evidenceReferenceCreate },
      billingUsageEvent: { create: mocks.billingUsageCreate },
      activity: { create: mocks.activityCreate },
    }));
  });

  it("sends only server-resolved source metadata as verified evidence to the provider", async () => {
    mocks.evidenceFindMany.mockResolvedValue([evidence("evidence-1")]);
    const response = await POST(request([{ statement: "A statement from the user.", evidenceId: "evidence-1" }], "client-1"));
    expect(response.status).toBe(201);
    expect(mocks.evidenceFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.analyzeBusinessIntent).toHaveBeenCalledTimes(1);
    const providerInput = mocks.analyzeBusinessIntent.mock.calls[0]?.[0];
    expect(providerInput.knownFacts[0]).toMatchObject({
      id: "evidence-1", title: "Official registry record",
      sourceUrl: "https://registry.example.gov/source",
      evidenceClass: "E3", verificationState: "SOURCE_VERIFIED_RECORD",
    });
    expect(providerInput.knownFacts[0].statement).toBe("A statement from the user.");
    expect(mocks.evidenceReferenceCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        proposalId: "proposal-1", evidenceId: "evidence-1",
        documentId: "document-1", workspaceId: "workspace-1",
      }),
    }));
  });

  it("rejects an evidence ID that does not resolve to an eligible scoped record", async () => {
    mocks.evidenceFindMany.mockResolvedValue([]);
    const response = await POST(request([{ statement: "A claim.", evidenceId: "foreign-or-missing" }], "client-1"));
    expect(response.status).toBe(422);
    expect(mocks.analyzeBusinessIntent).not.toHaveBeenCalled();
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

  it("rejects evidence without independent review, source metadata, or a clean available document", async () => {
    for (const bad of [
      evidence("evidence-1", { reviewStatus: "REVOKED" }),
      evidence("evidence-1", { source: null }),
      evidence("evidence-1", { retrievedAt: null }),
      evidence("evidence-1", { documents: [] }),
    ]) {
      mocks.evidenceFindMany.mockResolvedValue([bad]);
      const response = await POST(request([{ statement: "A claim.", evidenceId: "evidence-1" }], "client-1"));
      expect(response.status).toBe(422);
      expect(mocks.analyzeBusinessIntent).not.toHaveBeenCalled();
      expect(mocks.proposalCreate).not.toHaveBeenCalled();
      vi.clearAllMocks();
      mocks.getWorkspaceContext.mockResolvedValue({ userId: principal.userId, principal });
      mocks.hasInvalidRequestOrigin.mockReturnValue(false);
      mocks.enforceRateLimit.mockResolvedValue(null);
      mocks.assertEntitlement.mockResolvedValue(undefined);
      mocks.clientFindFirst.mockResolvedValue({ id: "client-1" });
      mocks.proposalCreate.mockResolvedValue({ id: "proposal-1", workspaceId: principal.workspaceId, status: "PROPOSED", version: 1 });
      mocks.billingUsageCreate.mockResolvedValue({ id: "usage-1" });
      mocks.activityCreate.mockResolvedValue({ id: "activity-1" });
      mocks.evidenceReferenceCreate.mockResolvedValue({ id: "reference-1" });
      mocks.analyzeBusinessIntent.mockResolvedValue({ proposal: validProposal, provider: "openai", model: "test-model" });
      mocks.authorizedTransaction.mockImplementation(async (_principal, _permission, callback) => callback({
        client: { findFirst: mocks.clientFindFirst },
        evidence: { findMany: mocks.evidenceFindMany },
        businessIntentProposal: { create: mocks.proposalCreate },
        businessIntentEvidenceReference: { create: mocks.evidenceReferenceCreate },
        billingUsageEvent: { create: mocks.billingUsageCreate },
        activity: { create: mocks.activityCreate },
      }));
    }
  });

  it("keeps a statement without an evidence ID explicitly unverified in provider input", async () => {
    const response = await POST(request([{ statement: "A user-supplied claim." }]));
    expect(response.status).toBe(201);
    const fact = mocks.analyzeBusinessIntent.mock.calls[0]?.[0].knownFacts[0];
    expect(fact).toMatchObject({ evidenceClass: "E1", verificationState: "UNVERIFIED_USER_CLAIM" });
    expect(fact).not.toHaveProperty("sourceUrl");
  });

  it("does not call provider or persist a proposal when workspace/client preflight rejects the evidence", async () => {
    mocks.clientFindFirst.mockResolvedValue(null);
    const response = await POST(request([{ statement: "A claim.", evidenceId: "evidence-1" }], "client-1"));
    expect(response.status).toBe(404);
    expect(mocks.analyzeBusinessIntent).not.toHaveBeenCalled();
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

  it("requires workspace-wide evidence for proposals without a selected client", async () => {
    mocks.evidenceFindMany.mockResolvedValue([evidence("evidence-1")]);
    const response = await POST(request([{ statement: "Workspace-level claim.", evidenceId: "evidence-1" }]));
    expect(response.status).toBe(422);
    expect(mocks.evidenceFindMany.mock.calls[0]?.[0].where.documents.some.clientId).toBeNull();
    expect(mocks.evidenceFindMany.mock.calls[0]?.[0].select.documents.where.clientId).toBeNull();
    expect(mocks.analyzeBusinessIntent).not.toHaveBeenCalled();
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

  it("revalidates evidence after the provider call and rejects a revoked or unavailable record", async () => {
    mocks.evidenceFindMany
      .mockResolvedValueOnce([evidence("evidence-1")])
      .mockResolvedValueOnce([]);
    const response = await POST(request([{ statement: "A claim tied to a source.", evidenceId: "evidence-1" }], "client-1"));
    expect(response.status).toBe(422);
    expect(mocks.evidenceFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.analyzeBusinessIntent).toHaveBeenCalledTimes(1);
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

  it("rejects a source snapshot that changes between preflight and persistence", async () => {
    mocks.evidenceFindMany
      .mockResolvedValueOnce([evidence("evidence-1")])
      .mockResolvedValueOnce([evidence("evidence-1", { source: "https://registry.example.gov/changed" })]);
    const response = await POST(request([{ statement: "A claim tied to a source.", evidenceId: "evidence-1" }], "client-1"));
    expect(response.status).toBe(409);
    expect(mocks.evidenceFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.analyzeBusinessIntent).toHaveBeenCalledTimes(1);
    expect(mocks.proposalCreate).not.toHaveBeenCalled();
  });

});
