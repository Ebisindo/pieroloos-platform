import { describe, expect, it } from "vitest";
import { isPublicRoute, publicRoutes } from "@/lib/navigation";

describe("public route classification", () => {
  it("allows signed-out access to FAQ, Terms and policy routes", () => {
    for (const route of ["/", "/partners", "/faq", "/terms", "/policies", "/policies/privacy", "/policies/ai-and-automation"]) {
      expect(isPublicRoute(route)).toBe(true);
    }
  });

  it("keeps authenticated workspaces and unknown routes private by default", () => {
    for (const route of ["/clients", "/portal", "/command-center", "/admin/dashboard", "/signin", "/api/partnerships/inquiries", "/policies/unknown"]) {
      expect(isPublicRoute(route)).toBe(false);
    }
  });

  it("lists only exact public routes including each current policy document", () => {
    expect(publicRoutes).toContain("/faq");
    expect(publicRoutes).toContain("/terms");
    expect(publicRoutes).toContain("/policies");
    expect(publicRoutes).toContain("/policies/privacy");
    expect(publicRoutes).not.toContain("/policies/unknown");
  });
});
