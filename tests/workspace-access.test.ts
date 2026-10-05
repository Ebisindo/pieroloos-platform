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
    expect(() => assertSameWorkspace(principal, {
      organizationId: "org-1",
      workspaceId: "workspace-1",
    })).not.toThrow();
    expect(() => assertSameWorkspace(principal, {
      organizationId: "org-2",
      workspaceId: "workspace-1",
    })).toThrow("organization boundary violation");
    expect(() => assertSameWorkspace(principal, {
      organizationId: "org-1",
      workspaceId: "workspace-2",
    })).toThrow("workspace boundary violation");
    expect(() => assertSameWorkspace(principal, {
      organizationId: "org-1",
      workspaceId: null,
    })).toThrow("workspace boundary violation");
  });

  it("derives the permission matrix from persisted role names", () => {
    expect(permissionsForRole("owner")).toContain("workspace:manage");
    expect(permissionsForRole("admin")).toContain("workspace:manage");
    expect(permissionsForRole("admin")).not.toContain("settings:manage");
    expect(permissionsForRole("member")).not.toContain("documents:review");
    expect(permissionsForRole("viewer")).not.toContain("engagement:write");
  });
});

describe("mutation request origin validation", () => {
  it("allows a same-origin Origin or Referer", () => {
    expect(hasInvalidRequestOrigin(new Request("https://app.example/api/write", {
      method: "POST",
      headers: { origin: "https://app.example" },
    }))).toBe(false);
    expect(hasInvalidRequestOrigin(new Request("https://app.example/api/write", {
      method: "POST",
      headers: { referer: "https://app.example/page" },
    }))).toBe(false);
  });

  it("rejects cross-origin or missing browser provenance", () => {
    expect(hasInvalidRequestOrigin(new Request("https://app.example/api/write", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }))).toBe(true);
    expect(hasInvalidRequestOrigin(new Request("https://app.example/api/write", { method: "POST" }))).toBe(true);
  });
});
