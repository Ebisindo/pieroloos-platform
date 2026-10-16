import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { POST } from "@/app/api/compliance/rules/[id]/versions/[versionId]/generate/route";

const {
  getWorkspaceContextMock, hasInvalidRequestOriginMock, authorizedTransactionMock,
  versionFindFirstMock, clientFindFirstMock, evidenceFindManyMock, obligationFindFirstMock,
  obligationCreateMock, deadlineSnapshotCreateMock, complianceActivityCreateMock, ruleActivityCreateMock,
  globalObligationFindFirstMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  versionFindFirstMock: vi.fn(),
  clientFindFirstMock: vi.fn(),
  evidenceFindManyMock: vi.fn(),
  obligationFindFirstMock: vi.fn(),
  obligationCreateMock: vi.fn(),
  deadlineSnapshotCreateMock: vi.fn(),
  complianceActivityCreateMock: vi.fn(),
  ruleActivityCreateMock: vi.fn(),
  globalObligationFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: hasInvalidRequestOriginMock }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { complianceObligation: { findFirst: globalObligationFindFirstMock } },
}));

const principal: WorkspacePrincipal = {
  userId: "staff-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:write"],
};

const now = new Date();
const version = {
  id: "version-1",
  ruleId: "rule-1",
  version: 2,
  jurisdictionId: "jurisdiction-1",
  title: "Annual report",
  description: "Reviewed source-backed rule.",
  obligationType: "ANNUAL_FILING",
  sourceUrl: "https://example.gov/rules/annual-report",
  sourceAuthority: "Official registry",
  sourceRetrievedAt: new Date(now.getTime() - 60_000),
  effectiveFrom: new Date("2020-01-01T00:00:00.000Z"),
  effectiveThrough: null,
  evidenceClass: "E3",
  applicability: { businessTypes: ["COMPANY"], formationCompleted: true },
  relativeDueDays: 30,
  requiresEvidence: true,
  professionalReviewRequired: true,
  reviewState: "VERIFIED",
};

const payload = () => ({
  clientId: "client-1",
  businessType: "COMPANY",
  formationCompleted: true,
  baseDate: "2026-10-01T00:00:00.000Z",
  factEvidence: [
    { key: "BUSINESS_TYPE", evidenceId: "ev-business" },
    { key: "FORMATION_COMPLETED", evidenceId: "ev-formation" },
    { key: "TRIGGER_DATE", evidenceId: "ev-trigger" },
  ],
});

function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/compliance/rules/rule-1/versions/version-1/generate", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({ id: "rule-1", versionId: "version-1" }) };

describe("reviewed compliance rule obligation generation", () => {
  beforeEach(() => {
    hasInvalidRequestOriginMock.mockReset().mockReturnValue(false);
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    const existing = { id: "obligation-1", workspaceId: principal.workspaceId, clientId: "client-1" };
    versionFindFirstMock.mockReset().mockResolvedValue(version);
    clientFindFirstMock.mockReset().mockResolvedValue({ id: "client-1" });
    evidenceFindManyMock.mockReset().mockResolvedValue([
      { id: "ev-business", documentId: "doc-1", evidenceClass: "E3", factKey: "BUSINESS_TYPE", factValue: "COMPANY", validThrough: null },
      { id: "ev-formation", documentId: "doc-2", evidenceClass: "E4", factKey: "FORMATION_COMPLETED", factValue: "true", validThrough: null },
      { id: "ev-trigger", documentId: "doc-3", evidenceClass: "E3", factKey: "TRIGGER_DATE", factValue: new Date(payload().baseDate).toISOString(), validThrough: null },
    ]);
    obligationFindFirstMock.mockReset().mockResolvedValue(null);
    obligationCreateMock.mockReset().mockResolvedValue(existing);
    deadlineSnapshotCreateMock.mockReset().mockResolvedValue({ id: "snapshot-1" });
    complianceActivityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    ruleActivityCreateMock.mockReset().mockResolvedValue({ id: "rule-activity-1" });
    globalObligationFindFirstMock.mockReset().mockResolvedValue(null);
    authorizedTransactionMock.mockReset().mockImplementation(async (_principal, _permission, callback) => callback({
      complianceRuleVersion: { findFirst: versionFindFirstMock },
      client: { findFirst: clientFindFirstMock },
      complianceEvidence: { findMany: evidenceFindManyMock },
      complianceObligation: { findFirst: obligationFindFirstMock, create: obligationCreateMock },
      complianceDeadlineSnapshot: { create: deadlineSnapshotCreateMock },
      complianceActivity: { create: complianceActivityCreateMock },
      complianceRuleActivity: { create: ruleActivityCreateMock },
    }));
  });

  it("rejects invalid origins before looking up a workspace or rule", async () => {
    hasInvalidRequestOriginMock.mockReturnValue(true);
    const response = await POST(request(payload(), "https://attacker.invalid"), routeContext);
    expect(response.status).toBe(403);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });

  it("returns UNKNOWN and creates nothing when the source rule is not independently verified", async () => {
    versionFindFirstMock.mockResolvedValueOnce({ ...version, reviewState: "UNREVIEWED" });
    const response = await POST(request(payload()), routeContext);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ data: { state: "UNKNOWN", reasons: ["RULE_NOT_VERIFIED"] }, mayGenerateObligation: false });
    expect(obligationCreateMock).not.toHaveBeenCalled();
    expect(deadlineSnapshotCreateMock).not.toHaveBeenCalled();
  });

  it("creates an obligation with immutable first deadline snapshot and two audit records", async () => {
    const response = await POST(request(payload()), routeContext);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { id: "obligation-1" }, alreadyExists: false });
    expect(obligationCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        workspaceId: "workspace-1",
        clientId: "client-1",
        sourceRuleId: "rule-1",
        sourceRuleVersionId: "version-1",
        generationKey: expect.any(String),
        dueAt: new Date("2026-10-31T00:00:00.000Z"),
        status: "NOT_STARTED",
      }),
    });
    expect(deadlineSnapshotCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sequence: 1,
        sourceRuleVersionId: "version-1",
        assessmentState: "APPLICABLE",
        dueAt: new Date("2026-10-31T00:00:00.000Z"),
      }),
    });
    expect(complianceActivityCreateMock).toHaveBeenCalled();
    expect(ruleActivityCreateMock).toHaveBeenCalled();
  });


  it("does not treat a null trigger date as the Unix epoch", async () => {
    const body = { ...payload(), baseDate: null };
    const response = await POST(request(body), routeContext);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      data: { state: "UNKNOWN", reasons: expect.arrayContaining(["MISSING_DEADLINE_TRIGGER_DATE"]) },
      mayGenerateObligation: false,
    });
    expect(obligationCreateMock).not.toHaveBeenCalled();
  });

  it("rejects facts without exact structured verified evidence bindings", async () => {
    evidenceFindManyMock.mockResolvedValueOnce([
      { id: "ev-business", documentId: "doc-1", evidenceClass: "E3", factKey: "BUSINESS_TYPE", factValue: "SOLE_PROPRIETOR", validThrough: null },
      { id: "ev-formation", documentId: "doc-2", evidenceClass: "E4", factKey: "FORMATION_COMPLETED", factValue: "true", validThrough: null },
      { id: "ev-trigger", documentId: "doc-3", evidenceClass: "E3", factKey: "TRIGGER_DATE", factValue: new Date(payload().baseDate).toISOString(), validThrough: null },
    ]);
    const response = await POST(request(payload()), routeContext);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ data: { state: "UNKNOWN", reasons: ["FACT_EVIDENCE_UNVERIFIED"] } });
    expect(obligationCreateMock).not.toHaveBeenCalled();
  });

  it("returns an existing obligation on repeat requests without side effects", async () => {
    obligationFindFirstMock.mockResolvedValueOnce({ id: "obligation-existing", workspaceId: principal.workspaceId });
    const response = await POST(request(payload()), routeContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { id: "obligation-existing" }, alreadyExists: true });
    expect(obligationCreateMock).not.toHaveBeenCalled();
    expect(deadlineSnapshotCreateMock).not.toHaveBeenCalled();
  });

  it("rechecks a unique-key race and returns the scoped existing obligation", async () => {
    obligationCreateMock.mockRejectedValueOnce({ code: "P2002" });
    globalObligationFindFirstMock.mockResolvedValueOnce({ id: "obligation-raced", workspaceId: principal.workspaceId, clientId: "client-1" });
    const response = await POST(request(payload()), routeContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { id: "obligation-raced" }, alreadyExists: true });
    expect(globalObligationFindFirstMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: "client-1",
        sourceRuleVersionId: "version-1",
        generationKey: expect.any(String),
      }),
    });
  });
});
