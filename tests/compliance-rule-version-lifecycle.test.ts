import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { POST } from "@/app/api/compliance/rules/[id]/versions/route";

const {
  getWorkspaceContextMock, hasInvalidRequestOriginMock, authorizedTransactionMock,
  ruleFindFirstMock, versionFindFirstMock, versionCreateMock, versionUpdateManyMock,
  ruleUpdateManyMock, activityCreateMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  hasInvalidRequestOriginMock: vi.fn(),
  authorizedTransactionMock: vi.fn(),
  ruleFindFirstMock: vi.fn(),
  versionFindFirstMock: vi.fn(),
  versionCreateMock: vi.fn(),
  versionUpdateManyMock: vi.fn(),
  ruleUpdateManyMock: vi.fn(),
  activityCreateMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/auth/request-origin", () => ({ hasInvalidRequestOrigin: hasInvalidRequestOriginMock }));
vi.mock("@/lib/auth/authorized-workspace-transaction", () => ({
  withAuthorizedWorkspaceTransaction: authorizedTransactionMock,
}));

const principal: WorkspacePrincipal = {
  userId: "staff-2",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: ["compliance:write"],
};

const payload = {
  title: "Annual report v2",
  description: "Updated description with source provenance.",
  type: "ANNUAL_FILING",
  sourceAuthority: "Official registry",
  sourceUrl: "https://example.gov/rules/annual-report",
  publicationDate: null,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  effectiveThrough: null,
  applicability: { businessTypes: ["COMPANY"] },
  relativeDueDays: 30,
  requiresEvidence: true,
};

function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/compliance/rules/rule-1/versions", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({ id: "rule-1" }) };

describe("immutable compliance rule-version lifecycle", () => {
  beforeEach(() => {
    hasInvalidRequestOriginMock.mockReset().mockReturnValue(false);
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal });
    ruleFindFirstMock.mockReset().mockResolvedValue({
      id: "rule-1", jurisdictionId: "jurisdiction-1", currentVersion: 1, ruleKey: "annual-report",
    });
    versionFindFirstMock.mockReset().mockResolvedValue({
      id: "version-1", version: 1, reviewState: "VERIFIED", supersededByVersion: null,
    });
    versionCreateMock.mockReset().mockResolvedValue({ id: "version-2", version: 2, reviewState: "UNREVIEWED" });
    versionUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    ruleUpdateManyMock.mockReset().mockResolvedValue({ count: 1 });
    activityCreateMock.mockReset().mockResolvedValue({ id: "activity-1" });
    authorizedTransactionMock.mockReset().mockImplementation(async (_principal, _permission, operation) => operation({
      complianceRule: { findFirst: ruleFindFirstMock, updateMany: ruleUpdateManyMock },
      complianceRuleVersion: { findFirst: versionFindFirstMock, create: versionCreateMock, updateMany: versionUpdateManyMock },
      complianceRuleActivity: { create: activityCreateMock },
    }));
  });

  it("creates a new draft and supersedes the previous version in one authorized transaction", async () => {
    const response = await POST(request(payload), routeContext);
    expect(response.status).toBe(201);
    expect(versionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ruleId: "rule-1",
        workspaceId: "workspace-1",
        version: 2,
        reviewState: "UNREVIEWED",
        sourceRetrievedAt: null,
        evidenceClass: "E1",
      }),
    });
    expect(versionUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: "version-1",
        ruleId: "rule-1",
        workspaceId: "workspace-1",
        version: 1,
        reviewState: "VERIFIED",
        supersededByVersion: null,
      },
      data: { reviewState: "SUPERSEDED", supersededByVersion: 2 },
    });
    expect(ruleUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ currentVersion: 1 }),
      data: { currentVersion: 2 },
    }));
    expect(activityCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "RULE_VERSION_DRAFT_CREATED",
        metadata: expect.objectContaining({ previousVersion: 1, version: 2, previousReviewState: "VERIFIED" }),
      }),
    }));
  });

  it("rejects a stale supersession race instead of advancing the current-version pointer", async () => {
    versionUpdateManyMock.mockResolvedValueOnce({ count: 0 });
    const response = await POST(request(payload), routeContext);
    expect(response.status).toBe(409);
    expect(ruleUpdateManyMock).not.toHaveBeenCalled();
    expect(activityCreateMock).not.toHaveBeenCalled();
  });

  it("refuses to version a rule outside the active workspace", async () => {
    ruleFindFirstMock.mockResolvedValueOnce(null);
    const response = await POST(request(payload), routeContext);
    expect(response.status).toBe(404);
    expect(versionCreateMock).not.toHaveBeenCalled();
    expect(versionUpdateManyMock).not.toHaveBeenCalled();
  });

  it("rejects unknown request fields and invalid non-HTTPS source URLs", async () => {
    const unknownField = await POST(request({ ...payload, reviewState: "VERIFIED" }), routeContext);
    expect(unknownField.status).toBe(422);
    const invalidUrl = await POST(request({ ...payload, sourceUrl: "http://example.gov/rules/annual-report" }), routeContext);
    expect(invalidUrl.status).toBe(422);
    expect(versionCreateMock).not.toHaveBeenCalled();
  });

  it("checks request origin before looking up the rule", async () => {
    hasInvalidRequestOriginMock.mockReturnValue(true);
    const response = await POST(request(payload, "https://attacker.invalid"), routeContext);
    expect(response.status).toBe(403);
    expect(getWorkspaceContextMock).not.toHaveBeenCalled();
    expect(authorizedTransactionMock).not.toHaveBeenCalled();
  });
});
