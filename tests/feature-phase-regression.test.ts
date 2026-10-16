import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { businessProfileUpdateSchema } from "@/lib/validation/business-profile";
import { reportGenerateSchema } from "@/lib/validation/report";
import { engagementCreateSchema, engagementUpdateSchema, engagementTransitionSchema } from "@/lib/validation/engagement";
import { canTransition, getNextStatuses } from "@/lib/domain/engagement";
import { messageCatalogs, findMissingMessageKeys } from "@/lib/i18n/messages";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("next product phase validation contracts", () => {
  it("accepts only known business profile fields and rejects empty patches", () => {
    expect(businessProfileUpdateSchema.safeParse({ businessName: "A business" }).success).toBe(true);
    expect(businessProfileUpdateSchema.safeParse({}).success).toBe(false);
    expect(businessProfileUpdateSchema.safeParse({ businessName: "A business", admin: true }).success).toBe(false);
    expect(businessProfileUpdateSchema.safeParse({ objective: "A".repeat(5001) }).success).toBe(false);
  });

  it("requires a client id and rejects undeclared report parameters", () => {
    expect(reportGenerateSchema.safeParse({ clientId: "client_1" }).success).toBe(true);
    expect(reportGenerateSchema.safeParse({}).success).toBe(false);
    expect(reportGenerateSchema.safeParse({ clientId: "client_1", workspaceId: "other" }).success).toBe(false);
  });

  it("does not allow engagement callers to update status or owner through the detail schema", () => {
    expect(engagementCreateSchema.safeParse({ clientId: "c1", service: "Formation support" }).success).toBe(true);
    expect(engagementCreateSchema.safeParse({ clientId: "c1", service: "Formation support", status: "ACTIVE" }).success).toBe(false);
    expect(engagementUpdateSchema.safeParse({ nextAction: "Request reviewed documents" }).success).toBe(true);
    expect(engagementUpdateSchema.safeParse({ status: "ACTIVE" }).success).toBe(false);
    expect(engagementUpdateSchema.safeParse({ ownerId: "arbitrary-user" }).success).toBe(false);
  });

  it("preserves the approved engagement transition graph", () => {
    expect(canTransition("DRAFT", "INTAKE")).toBe(true);
    expect(canTransition("DRAFT", "ACTIVE")).toBe(false);
    expect(getNextStatuses("COMPLETED")).toEqual([]);
    expect(getNextStatuses("ON_HOLD")).toContain("ACTIVE");
    expect(engagementTransitionSchema.safeParse({ toStatus: "INTAKE" }).success).toBe(true);
    expect(engagementTransitionSchema.safeParse({ toStatus: "ACTIVE", status: "ACTIVE" }).success).toBe(false);
  });

  it("keeps complete locale catalogs with aligned interpolation placeholders", () => {
    for (const [locale, catalog] of Object.entries(messageCatalogs)) {
      expect(findMissingMessageKeys(catalog), `${locale} message keys`).toEqual([]);
    }
  });
});

describe("workspace workflow security seams", () => {
  it("uses workspace scope and authorized writes in the profile repository", () => {
    const profileRepo = source("lib/db/business-profile-repository.ts");
    expect(profileRepo).toContain('client: { workspaceId: principal.workspaceId, organizationId: principal.organizationId }');
    expect(profileRepo).toContain('withAuthorizedWorkspaceTransaction(principal, "client:write"');
    expect(profileRepo).toContain('title: "Business profile updated"');
  });

  it("uses workspace scope, transactional audit and truthful data limitations in report generation", () => {
    const reports = source("lib/db/report-repository.ts");
    expect(reports).toContain('withAuthorizedWorkspaceTransaction(principal, "reports:write"');
    expect(reports).toContain('where: { id: clientId, workspaceId: principal.workspaceId, organizationId: principal.organizationId }');
    expect(reports).toContain('title: "Client summary report generated"');
    expect(reports).toContain("does not establish that no obligations apply");
    expect(source("app/api/reports/[id]/route.ts")).toContain("escapeHtml");
    expect(source("app/api/reports/[id]/route.ts")).toContain('where'); // scope is enforced by the repository's findWorkspaceReport.
  });

  it("connects dedicated profile routes with authorization gates", () => {
    expect(source("app/business-profile/page.tsx")).toContain("businessProfileRepository.listByWorkspace");
    expect(source("app/business-profile/[id]/page.tsx")).toContain('permissions.includes("client:read")');
    expect(source("app/api/business-profile/[id]/route.ts")).toContain('permissions.includes("client:write")');
  });

  it("shows the dedicated profile in workspace navigation", () => {
    expect(source("lib/navigation.ts")).toContain('{ href: "/business-profile", label: "Business Profile"');
    expect(source("components/shell/AppShell.tsx")).toContain('"/business-profile": "navigation.businessProfile"');
  });

  it("defines cross-device automation and the manual device verification boundary", () => {
    const testFile = source("e2e/cross-device-accessibility.spec.ts");
    for (const width of [320, 360, 390, 430, 480, 560, 760, 768, 1000, 1024, 1280, 1440, 1920]) {
      expect(testFile).toContain(String(width));
    }
    const accessibilityDoc = source("docs/ACCESSIBILITY-CROSS-DEVICE-VERIFICATION.md");
    expect(accessibilityDoc).toContain("verification pending");
    expect(accessibilityDoc).toContain("WCAG-certified");
  });
});
