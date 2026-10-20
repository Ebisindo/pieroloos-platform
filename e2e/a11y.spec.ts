import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated axe-core rules only. This is not a WCAG conformance claim; manual keyboard and screen-reader review remain required.
for (const locale of ["en", "fr", "pt", "es"]) {
  for (const route of ["/", "/partners"]) {
    test(`axe WCAG A/AA scan ${route} (${locale})`, async ({ page, context }) => {
      await context.addCookies([{ name: "pieroloos-locale", value: locale, url: "http://127.0.0.1:3100" }]);
      await page.goto(route);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.passes.length).toBeGreaterThan(0);
      expect(results.violations.map(v => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
}
