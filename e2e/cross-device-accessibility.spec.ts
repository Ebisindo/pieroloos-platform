import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const widths = [320, 360, 390, 430, 480, 560, 760, 768, 1000, 1024, 1280, 1440, 1920];
const publicRoutes = ["/", "/partners"];
const protectedRoutes = ["/business-profile", "/reports", "/engagements", "/command-center"];

test.describe("cross-device responsive smoke matrix", () => {
  for (const route of publicRoutes) {
    test(`${route} renders without horizontal overflow across viewport matrix`, async ({ page }) => {
      await mkdir(join(process.cwd(), "test-results", "responsive"), { recursive: true });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
        const overflow = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        }));
        expect(overflow.documentWidth, `${route} has horizontal overflow at ${width}px: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(overflow.viewportWidth + 1);
        if ([320, 390, 760, 1024, 1440, 1920].includes(width)) {
          const slug = route === "/" ? "home" : "partners";
          await page.screenshot({ path: join(process.cwd(), "test-results", "responsive", `${slug}-${width}.png`), fullPage: true });
        }
      }
    });
  }

  test("public routes have a main landmark and a visible primary link", async ({ page }) => {
    for (const route of publicRoutes) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toHaveCount(1);
      const links = page.getByRole("link");
      await expect(links.first()).toBeVisible();
      const html = await page.locator("html").getAttribute("lang");
      expect(html).toBeTruthy();
    }
  });

  test("axe reports no serious or critical findings on representative public routes", async ({ page }) => {
    for (const route of publicRoutes) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(route, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const blockers = results.violations.filter((item) => item.impact === "critical" || item.impact === "serious");
      expect(blockers.map((item) => ({ id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.length })), `Axe blockers on ${route}`).toEqual([]);
    }
  });

  test("workspace modules show signed-out access gates at narrow and wide widths", async ({ page }) => {
    for (const route of protectedRoutes) {
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await expect(page.locator("body")).toBeVisible();
        const overflow = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        }));
        expect(overflow.documentWidth, `${route} has signed-out overflow at ${width}px`).toBeLessThanOrEqual(overflow.viewportWidth + 1);
        const bodyText = (await page.locator("body").innerText()).toLowerCase();
        expect(bodyText.includes("sign in") || bodyText.includes("authentication") || bodyText.includes("workspace") || bodyText.includes("connexion") || bodyText.includes("iniciar sesión") || bodyText.includes("iniciar sessão")).toBeTruthy();
      }
    }
  });
});
