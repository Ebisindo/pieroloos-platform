import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const widths = [320, 360, 390, 430, 480, 560, 760, 768, 1000, 1024, 1280, 1440, 1920];
const publicRoutes = ["/", "/partners"];
const protectedRoutes = ["/business-profile", "/reports", "/engagements", "/command-center"];

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, route: string, width: number) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(
    dimensions.documentWidth,
    `${route} has horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

async function expectNoSeriousAxeViolations(page: import("@playwright/test").Page, route: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  // Preserve every finding, including moderate/minor items, in the Playwright report for human triage.
  const findings = results.violations.map((item) => ({
    id: item.id,
    impact: item.impact,
    help: item.help,
    description: item.description,
    helpUrl: item.helpUrl,
    nodes: item.nodes.map((node) => ({
      target: node.target,
      summary: node.failureSummary,
      any: node.any.map((check) => ({ id: check.id, message: check.message })),
      all: node.all.map((check) => ({ id: check.id, message: check.message })),
      none: node.none.map((check) => ({ id: check.id, message: check.message })),
    })),
  }));
  const attachmentName = `axe-${route.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  await test.info().attach(attachmentName, {
    body: Buffer.from(JSON.stringify({ route, violations: findings }, null, 2)),
    contentType: "application/json",
  });

  const blockers = findings.filter((item) => item.impact === "critical" || item.impact === "serious");
  expect(blockers, `Critical/serious axe findings on ${route}`).toEqual([]);
}

async function captureAuthenticatedViewportMatrix(
  page: import("@playwright/test").Page,
  route: string,
  slug: string,
) {
  // Avoid capturing the decorative boot overlay; wait for the actual authenticated view to be revealed.
  const bootLayer = page.locator(".boot-layer");
  if (await bootLayer.count()) await expect(bootLayer).toHaveClass(/boot-hidden/);
  await expect(page.locator("main")).toHaveCount(1);
  await mkdir(join(process.cwd(), "test-results", "responsive"), { recursive: true });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    // The sidebar animates off-canvas at tablet/mobile sizes; wait for the transition
    // rather than capturing a misleading mid-animation screenshot.
    if (width <= 1000) {
      await expect(page.locator(".sidebar")).toHaveCSS("visibility", "hidden");
    } else {
      await expect(page.locator(".sidebar")).toHaveCSS("visibility", "visible");
    }
    await expect(page.locator("main"), `${route} should remain rendered at ${width}px`).toHaveCount(1);
    await expectNoHorizontalOverflow(page, route, width);
    await page.screenshot({
      path: join(process.cwd(), "test-results", "responsive", `authenticated-${slug}-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

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

  test("language selector keeps an accessible name without exposing its label visually", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("label.sr-only[for] + select.language-select")).toHaveCount(1);
    await expect(page.locator("select.language-select")).toHaveAccessibleName("Select language");
  });

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
        await expect(page.locator("main"), `${route} should expose one primary main landmark`).toHaveCount(1);
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
    expect(new URL(page.url()).origin).toBe("http://localhost:3100");
    await expect(page.getByText("Foreign Private Business", { exact: true })).toHaveCount(0);

    const foreignProfileResponse = await page.request.get("/api/business-profile/pieroloos-e2e-foreign-profile");
    const foreignReportResponse = await page.request.get("/api/reports/pieroloos-e2e-foreign-report");
    const foreignEngagementResponse = await page.request.get("/api/engagements/pieroloos-e2e-foreign-engagement");
    expect(foreignProfileResponse.status()).toBe(404);
    expect(foreignReportResponse.status()).toBe(404);
    expect(foreignEngagementResponse.status()).toBe(404);

    const reportsListResponse = await page.request.get("/api/reports");
    expect(reportsListResponse.ok()).toBeTruthy();
    const reportsListBody = await reportsListResponse.json() as { data?: { reports?: Array<{ id: string; title: string }> } };
    expect(reportsListBody.data?.reports?.some((item) => item.id === "pieroloos-e2e-foreign-report" || item.title === "Foreign Private Report")).toBe(false);

    const engagementListResponse = await page.request.get("/api/engagements");
    expect(engagementListResponse.ok()).toBeTruthy();
    const engagementListBody = await engagementListResponse.json() as { data?: Array<{ id: string; service: string }> };
    expect(engagementListBody.data?.some((item) => item.id === "pieroloos-e2e-foreign-engagement" || item.service === "Foreign Private Engagement")).toBe(false);

    await captureAuthenticatedViewportMatrix(page, "/business-profile", "profiles-list");
    await expectNoSeriousAxeViolations(page, "/business-profile");
    await page.getByRole("link", { name: /Primary E2E Consulting/ }).click();
    const objective = page.getByLabel("Business objective");
    await captureAuthenticatedViewportMatrix(page, "/business-profile/[id]", "profile-detail");
    await expectNoSeriousAxeViolations(page, "/business-profile/[id]");
    await expect(objective).toHaveValue("Initial objective from CI seed");
    await objective.fill("Updated objective from authenticated E2E");
    const profileSaveResponsePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/business-profile/${encodeURIComponent(new URL(page.url()).pathname.split("/").pop()!)}`) &&
      response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Save profile" }).click();
    const profileSaveResponse = await profileSaveResponsePromise;
    expect(profileSaveResponse.status(), await profileSaveResponse.text()).toBe(200);
    await expect(page.getByText("Saved as version 2.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Business objective")).toHaveValue("Updated objective from authenticated E2E");

    await page.goto("/reports", { waitUntil: "domcontentloaded" });
    await captureAuthenticatedViewportMatrix(page, "/reports", "reports");
    await expectNoSeriousAxeViolations(page, "/reports");
    const reportClient = page.getByLabel("Client record");
    await expect(reportClient.locator('option[value="pieroloos-e2e-primary-client"]')).toHaveText("E2E Primary Client");
    const reportOptions = await reportClient.locator("option").allTextContents();
    expect(reportOptions).not.toContain("Foreign Private Client");
    await reportClient.selectOption({ label: "E2E Primary Client" });
    await page.getByRole("button", { name: "Generate client summary" }).click();
    await expect(page.getByText("Report generated and saved.", { exact: true })).toBeVisible();
    await expect(page.getByText("Updated objective from authenticated E2E", { exact: false })).toBeVisible();
    await captureAuthenticatedViewportMatrix(page, "/reports (generated summary)", "reports-generated-summary");
    await expectNoSeriousAxeViolations(page, "/reports (generated summary)");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download / print HTML" }).click();
    const reportDownload = await downloadPromise;
    expect(reportDownload.suggestedFilename()).toMatch(/^pieroloos-report-.+\.html$/);
    const downloadedReportPath = await reportDownload.path();
    expect(downloadedReportPath).not.toBeNull();
    const downloadedReportHtml = await readFile(downloadedReportPath!, "utf8");
    expect(downloadedReportHtml).toContain("Updated objective from authenticated E2E");
    expect(downloadedReportHtml).toContain("professional review");
    expect(downloadedReportHtml).not.toContain("<script>");

    await page.goto("/engagements", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Engagements", exact: true })).toBeVisible();
    await captureAuthenticatedViewportMatrix(page, "/engagements", "engagements-list");
    await expectNoSeriousAxeViolations(page, "/engagements");
    await expect(page.getByText("Foreign Private Client", { exact: true })).toHaveCount(0);
    await page.locator("details > summary").filter({ hasText: "New engagement" }).click();
    const createEngagementButton = page.getByRole("button", { name: "Create engagement" });
    await expect(createEngagementButton).toBeVisible();
    const engagementClientSelect = page.locator("select").filter({
      has: page.locator('option[value="pieroloos-e2e-primary-client"]'),
    });
    await expect(engagementClientSelect).toBeVisible();
    await engagementClientSelect.selectOption("pieroloos-e2e-primary-client");
    await page.getByLabel("Service", { exact: true }).fill("Authenticated Playwright engagement");
    await page.getByLabel("Next action", { exact: true }).fill("Request reviewed formation documents");
    await page.getByRole("button", { name: "Create engagement" }).click();
    await expect(page.getByText("Engagement created.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Open engagement" }).first().click();

    await expect(page.getByRole("heading", { name: "Edit engagement" })).toBeVisible();
    await captureAuthenticatedViewportMatrix(page, "/engagements/[id]", "engagement-detail");
    await expectNoSeriousAxeViolations(page, "/engagements/[id]");
    await page.getByLabel("Service", { exact: true }).fill("Authenticated Playwright engagement updated");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Engagement details saved.", { exact: true })).toBeVisible();

    const nextStatusSelect = page.locator("select").filter({
      has: page.locator('option[value="INTAKE"]'),
    });
    await expect(nextStatusSelect).toBeVisible();
    await nextStatusSelect.selectOption("INTAKE");
    await page.getByRole("button", { name: "Apply status change" }).click();
    await expect(page.getByText("Engagement status updated.", { exact: true })).toBeVisible();
    await expect(page.getByText("Status changed to Intake", { exact: true })).toBeVisible();
  });

});
