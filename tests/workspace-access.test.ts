import { describe, expect, it } from "vitest";
import { assertSameWorkspace, permissionsForRole } from "@/lib/auth/workspace-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-access";

const principal: WorkspacePrincipal = {
  userId: "user-1",
  organizationId: "org-1",
  workspaceId: "workspace-1",
  role: "owner",
  permissions: permissionsForRole("owner"),
};

describe("workspace authorization boundaries", () => {
  it("requires both organization and workspace equality for resource authorization", () => {
    expect(() => assertSameWorkspace(principal, { organizationId: "org-1", workspaceId: "workspace-1" })).not.toThrow();
    expect(() => assertSameWorkspace(principal, { organizationId: "org-2", workspaceId: "workspace-1" })).toThrow("organization boundary violation");
    expect(() => assertSameWorkspace(principal, { organizationId: "org-1", workspaceId: "workspace-2" })).toThrow("workspace boundary violation");
    expect(() => assertSameWorkspace(principal, { organizationId: "org-1", workspaceId: null })).toThrow("workspace boundary violation");
  });

  it("keeps owner and admin powers distinct", () => {
    expect(permissionsForRole("owner")).toContain("settings:manage");
    expect(permissionsForRole("admin")).toContain("workspace:manage");
    expect(permissionsForRole("admin")).not.toContain("settings:manage");
  });

  it("limits advisor and member destructive and review permissions", () => {
    expect(permissionsForRole("advisor")).toContain("documents:review");
    expect(permissionsForRole("advisor")).not.toContain("client:delete");
    expect(permissionsForRole("advisor")).not.toContain("documents:delete");
    expect(permissionsForRole("member")).toContain("compliance:write");
    expect(permissionsForRole("member")).not.toContain("documents:review");
    expect(permissionsForRole("member")).not.toContain("documents:delete");
  });

  it("keeps viewer read-only", () => {
    const viewer = permissionsForRole("viewer");
    expect(viewer).toContain("workspace:read");
    expect(viewer).toContain("client:read");
    expect(viewer).toContain("documents:read");
    expect(viewer).not.toContain("workspace:manage");
    expect(viewer).not.toContain("client:write");
    expect(viewer).not.toContain("engagement:write");
    expect(viewer).not.toContain("documents:write");
    expect(viewer).not.toContain("compliance:write");
    expect(viewer).not.toContain("settings:manage");
  });

  it("maps product aliases through the central role policy", () => {
    expect(permissionsForRole("owner")).toContain("documents:delete");
    expect(permissionsForRole("advisor")).toContain("documents:review");
    expect(permissionsForRole("advisor")).not.toContain("documents:delete");
    expect(permissionsForRole("member")).not.toContain("documents:review");
    expect(permissionsForRole("viewer")).not.toContain("formation:write");
  });
});

describe("mutation request origin validation", () => {
  it("allows a same-origin Origin or Referer", () => {
    expect(hasInvalidRequestOrigin(new Request("https://app.example/api/write", {
      method: "POST", headers: { origin: "https://app.example" },
    }))).toBe(false);
    expect(hasInvalidRequestOrigin(new Request("https://app.example/api/write", {
      method: "POST", headers: { referer: "https://app.example/page" },
    }))).toBe(false);
  });

  it("rejects cross-origin or missing browser provenance", () => {
    expect(hasInvalidRequestOrigin(new Request("https://app.example/api/write", {
      method: "POST", headers: { origin: "https://attacker.example" },
    }))).toBe(true);
    expect(hasInvalidRequestOrigin(new Request("https://app.example/api/write", { method: "POST" }))).toBe(true);
  });
});
