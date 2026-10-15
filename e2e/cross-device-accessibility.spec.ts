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

  test("workspace shell skip link can be reached and activated by keyboard while signed out", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/reports", { waitUntil: "domcontentloaded" });

    const skipLink = page.locator("a.skip-link");
    await expect(skipLink).toHaveAttribute("href", "#main-content");
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("#main-content")).toBeFocused();
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

  test("authenticated Business Profile, Reports, and Engagements workflows persist and remain workspace-scoped", async ({ page }) => {
    test.skip(
      !process.env.PIEROLO_E2E_AUTH_SECRET || !process.env.PIEROLO_E2E_TEST_EMAIL,
      "Requires the isolated CI-only test identity and disposable PostgreSQL database.",
    );
    test.setTimeout(90_000);

    const testEmail = process.env.PIEROLO_E2E_TEST_EMAIL!;
    const testSecret = process.env.PIEROLO_E2E_AUTH_SECRET!;

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/signin?callbackUrl=/business-profile", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Isolated CI test account email").fill(testEmail);
    await page.getByLabel("Temporary CI test secret").fill(testSecret);
    await page.getByRole("button", { name: "Sign in to isolated CI workspace" }).click();
    await expect(page).toHaveURL(/\/business-profile$/);
    await expect(page.getByRole("heading", { name: "Business Profiles" })).toBeVisible();

    await page.getByRole("link", { name: /Primary E2E Consulting/ }).click();
    const objective = page.getByLabel("Business objective");
    await expect(objective).toHaveValue("Initial objective from CI seed");
    await objective.fill("Updated objective from authenticated E2E");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Saved as version 2.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Business objective")).toHaveValue("Updated objective from authenticated E2E");

    await page.goto("/reports", { waitUntil: "domcontentloaded" });
    const reportClient = page.getByLabel("Client record");
    await expect(reportClient.locator("option")).toContainText("E2E Primary Client");
    const reportOptions = await reportClient.locator("option").allTextContents();
    expect(reportOptions).not.toContain("Foreign Private Client");
    await reportClient.selectOption({ label: "E2E Primary Client" });
    await page.getByRole("button", { name: "Generate client summary" }).click();
    await expect(page.getByText("Report generated and saved.", { exact: true })).toBeVisible();
    await expect(page.getByText("Updated objective from authenticated E2E", { exact: false })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download / print HTML" }).click();
    const reportDownload = await downloadPromise;
    expect(reportDownload.suggestedFilename()).toMatch(/^pieroloos-report-.+\.html$/);

    await page.goto("/engagements", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Engagements" })).toBeVisible();
    await expect(page.getByText("Foreign Private Client", { exact: true })).toHaveCount(0);
    await page.getByText("New engagement", { exact: true }).click();
    await page.getByLabel("Client", { exact: true }).selectOption({ label: "E2E Primary Client" });
    await page.getByLabel("Service", { exact: true }).fill("Authenticated Playwright engagement");
    await page.getByLabel("Next action", { exact: true }).fill("Request reviewed formation documents");
    await page.getByRole("button", { name: "Create engagement" }).click();
    await expect(page.getByText("Engagement created.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Open engagement" }).first().click();

    await expect(page.getByRole("heading", { name: "Edit engagement" })).toBeVisible();
    await page.getByLabel("Service", { exact: true }).fill("Authenticated Playwright engagement updated");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Engagement details saved.", { exact: true })).toBeVisible();

    await page.getByLabel("Next status", { exact: true }).selectOption("INTAKE");
    await page.getByRole("button", { name: "Apply status change" }).click();
    await expect(page.getByText("Engagement status updated.", { exact: true })).toBeVisible();
    await expect(page.getByText("Status changed to INTAKE", { exact: true })).toBeVisible();
  });

});
