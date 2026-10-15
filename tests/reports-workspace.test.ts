import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { GET as listReports, POST as generateReport } from "@/app/api/reports/route";
import { GET as getReport } from "@/app/api/reports/[id]/route";

const {
  getWorkspaceContextMock,
  listWorkspaceReportsMock,
  listReportClientsMock,
  generateClientSummaryMock,
  findWorkspaceReportMock,
} = vi.hoisted(() => ({
  getWorkspaceContextMock: vi.fn(),
  listWorkspaceReportsMock: vi.fn(),
  listReportClientsMock: vi.fn(),
  generateClientSummaryMock: vi.fn(),
  findWorkspaceReportMock: vi.fn(),
}));

vi.mock("@/lib/auth/workspace-context", () => ({ getWorkspaceContext: getWorkspaceContextMock }));
vi.mock("@/lib/db/report-repository", () => ({
  reportRepository: {
    listWorkspaceReports: listWorkspaceReportsMock,
    listReportClients: listReportClientsMock,
    generateClientSummary: generateClientSummaryMock,
    findWorkspaceReport: findWorkspaceReportMock,
  },
}));

const principal: WorkspacePrincipal = {
  userId: "staff-1",
  organizationId: "org-a",
  workspaceId: "workspace-a",
  role: "owner",
  permissions: ["reports:read", "reports:write"],
};
const collectionRequest = (body: unknown) => new Request("http://localhost/api/reports", {
  method: "POST",
  headers: { origin: "http://localhost", "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("workspace Reports endpoints", () => {
  beforeEach(() => {
    getWorkspaceContextMock.mockReset().mockResolvedValue({ userId: principal.userId, principal, activeWorkspace: true });
    listWorkspaceReportsMock.mockReset().mockResolvedValue([]);
    listReportClientsMock.mockReset().mockResolvedValue([]);
    generateClientSummaryMock.mockReset().mockResolvedValue({
      id: "report-a",
      title: "Client summary",
      createdAt: new Date("2026-10-15T12:00:00.000Z"),
      document: { title: "Client summary", clientId: "client-a", generatedAt: "2026-10-15T12:00:00.000Z", sections: [], disclaimer: "Decision-support only." },
    });
    findWorkspaceReportMock.mockReset().mockResolvedValue({
      id: "report-a",
      title: "Client summary",
      format: "PIEROLOOS_CLIENT_SUMMARY_V1",
      status: "GENERATED",
      createdAt: new Date("2026-10-15T12:00:00.000Z"),
      client: { id: "client-a", name: "Example", organizationName: null },
      content: JSON.stringify({
        title: "<script>alert(1)</script>",
        clientId: "client-a",
        generatedAt: "2026-10-15T12:00:00.000Z",
        sections: [{ id: "profile", title: "<img src=x onerror=alert(1)>", content: "<script>alert(1)</script>" }],
        disclaimer: "<b>Review required</b>",
      }),
    });
  });

  it("does not expose reports before authentication", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: null, principal: null });
    const response = await listReports();
    expect(response.status).toBe(401);
    expect(listWorkspaceReportsMock).not.toHaveBeenCalled();
  });

  it("requires reports write permission before generation", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal: { ...principal, permissions: ["reports:read"] } });
    const response = await generateReport(collectionRequest({ clientId: "client-a" }));
    expect(response.status).toBe(403);
    expect(generateClientSummaryMock).not.toHaveBeenCalled();
  });

  it("rejects undeclared fields and forwards only a validated client ID", async () => {
    const invalid = await generateReport(collectionRequest({ clientId: "client-a", workspaceId: "workspace-b" }));
    expect(invalid.status).toBe(422);
    expect(generateClientSummaryMock).not.toHaveBeenCalled();

    const valid = await generateReport(collectionRequest({ clientId: "client-a" }));
    expect(valid.status).toBe(201);
    expect(generateClientSummaryMock).toHaveBeenCalledWith("client-a", principal);
  });

  it("does not query the client selector for read-only report members without write permission", async () => {
    getWorkspaceContextMock.mockResolvedValue({ userId: principal.userId, principal: { ...principal, permissions: ["reports:read"] } });
    const response = await listReports();
    expect(response.status).toBe(200);
    expect(listWorkspaceReportsMock).toHaveBeenCalledWith({ ...principal, permissions: ["reports:read"] });
    expect(listReportClientsMock).not.toHaveBeenCalled();
  });

  it("returns 404 for reports not found in the active workspace", async () => {
    findWorkspaceReportMock.mockResolvedValue(null);
    const response = await getReport(new Request("http://localhost/api/reports/foreign-id"), { params: Promise.resolve({ id: "foreign-id" }) });
    expect(response.status).toBe(404);
    expect(findWorkspaceReportMock).toHaveBeenCalledWith("foreign-id", principal);
  });

  it("escapes untrusted report content in downloadable HTML", async () => {
    const response = await getReport(new Request("http://localhost/api/reports/report-a?format=html"), { params: Promise.resolve({ id: "report-a" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    const html = await response.text();
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
});
