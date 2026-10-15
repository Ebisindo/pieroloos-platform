import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("operational banner integration", () => {
  it("mounts the reusable banner on the command center and requested module routes", () => {
    for (const path of [
      "app/command-center/page.tsx",
      "app/clients/new/page.tsx",
      "app/jurisdictions/page.tsx",
      "app/formation/page.tsx",
      "app/compliance/page.tsx",
      "app/reports/page.tsx",
      "app/engagements/page.tsx",
    ]) expect(read(path), path).toContain("ModuleBanner");
  });

  it("preserves workspace data and write permissions", () => {
    const dashboard = read("app/command-center/page.tsx");
    const formation = read("app/formation/page.tsx");
    const compliance = read("app/compliance/page.tsx");
    expect(dashboard).toContain("getWorkspaceContext");
    expect(dashboard).toContain("listActiveOperationalActions");
    expect(formation).toContain('includes("formation:write")');
    expect(compliance).toContain('includes("compliance:write")');
    expect(compliance).toContain("ComplianceWorkflow");
  });

  it("uses unique accessible heading ids and small-screen/reduced-motion rules", () => {
    expect(read("components/ui/ModuleBanner.tsx")).toContain("useId()");
    expect(read("components/ui/ModuleBanner.tsx")).toContain("aria-labelledby={titleId}");
    const css = read("app/globals.css");
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("localizes banner copy in all configured catalogs", () => {
    for (const path of ["lib/i18n/messages/en.ts", "lib/i18n/messages/fr.ts", "lib/i18n/messages/es.ts", "lib/i18n/messages/pt.ts"]) {
      const catalog = read(path);
      expect(catalog).toContain('"ui.banner.complianceDescription"');
      expect(catalog).toContain('"ui.banner.formationDescription"');
      expect(catalog).toContain('"ui.banner.reportsDescription"');
    }
  });
});
