import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("responsive visual system", () => {
  it("uses the authoritative BrandLogo wrapper in the visual preview", () => {
    const page = read("app/command-center/visual-preview/page.tsx");
    expect(page).toContain('from "@/components/brand/BrandLogo"');
    expect(page).toContain('<BrandLogo');
  });

  it("defines responsive layout breakpoints and reduced-motion handling", () => {
    const css = read("app/globals.css");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (max-width: 1000px)");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain(".module-banner");
  });

  it("discloses that illustration metrics are not live data", () => {
    const page = read("app/command-center/visual-preview/page.tsx");
    expect(page).toContain("illustrative, not live workspace data");
  });

  it("keeps comparison and compliance illustrations bounded by professional review language", () => {
    expect(read("components/illustrations/JurisdictionCompareIllustration.tsx"))
      .toContain("not legal or tax conclusions");
    expect(read("components/illustrations/CompliancePulseIllustration.tsx"))
      .toContain("not a legal determination");
  });
});
