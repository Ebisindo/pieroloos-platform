import { expect, test } from "@playwright/test";

const select = (page: import("@playwright/test").Page) => page.locator("select.language-select");

test("language selection updates lang attribute and persists across routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await select(page).selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.goto("/partners");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.reload();
  await expect(select(page)).toHaveValue("fr");
});

test("partner form state survives a language switch", async ({ page }) => {
  await page.goto("/partners");
  const field = page.locator("form input:not([type=hidden]):not([type=checkbox])").first();
  await field.fill("Preserved value");
  await select(page).selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("form input:not([type=hidden]):not([type=checkbox])").first()).toHaveValue("Preserved value");
});

for (const [name, size] of [["mobile", { width: 375, height: 812 }], ["tablet", { width: 768, height: 1024 }], ["desktop", { width: 1440, height: 900 }]] as const) {
  for (const locale of ["en", "fr", "pt", "es"]) {
    test(`no horizontal overflow: ${name} ${locale}`, async ({ page, context }) => {
      await context.addCookies([{ name: "pieroloos-locale", value: locale, url: "http://127.0.0.1:3100" }]);
      await page.setViewportSize(size);
      for (const route of ["/", "/partners"]) {
        await page.goto(route);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} overflow`).toBeLessThanOrEqual(1);
      }
    });
  }
}

test("keyboard users can reach the language selector with visible focus", async ({ page }) => {
  await page.goto("/");
  const s = select(page);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await s.evaluate(el => el === document.activeElement)) break;
  }
  await expect(s).toBeFocused();
  const outline = await s.evaluate(el => getComputedStyle(el).outlineStyle + "|" + getComputedStyle(el).boxShadow);
  expect(outline).not.toBe("none|none");
});

test("switching language preserves path and query string", async ({ page }) => {
  await page.goto("/partners?ref=e2e&utm=1");
  await select(page).selectOption("pt");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/partners");
  expect(url.searchParams.get("ref")).toBe("e2e");
  expect(url.searchParams.get("utm")).toBe("1");
});

test("locale cookie is SameSite=Lax, scoped to the site and carries no identity data", async ({ page, context }) => {
  await page.goto("/");
  await select(page).selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  const cookie = (await context.cookies()).find(c => c.name === "pieroloos-locale");
  expect(cookie?.value).toBe("fr");
  expect(cookie?.sameSite).toBe("Lax");
  expect(cookie?.path).toBe("/");
});

test("locale preference does not leak between browser contexts", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  await pa.goto("/");
  await pa.locator("select.language-select").selectOption("es");
  await expect(pa.locator("html")).toHaveAttribute("lang", "es");
  await pb.goto("/");
  await expect(pb.locator("html")).toHaveAttribute("lang", "en");
  await a.close();
  await b.close();
});

test("unknown cookie value falls back to English", async ({ page, context }) => {
  await context.addCookies([{ name: "pieroloos-locale", value: "xx<script>", url: "http://127.0.0.1:3100" }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

for (const locale of ["fr", "pt", "es"]) {
  test(`404 page and signed-out protected route are localized and overflow-free (${locale})`, async ({ page, context }) => {
    await context.addCookies([{ name: "pieroloos-locale", value: locale, url: "http://127.0.0.1:3100" }]);
    await page.setViewportSize({ width: 375, height: 812 });
    for (const route of ["/this-route-does-not-exist", "/clients"]) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} overflow`).toBeLessThanOrEqual(1);
    }
  });
}

test("public pages stay indexable only at canonical English-cookie-independent URLs", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /partners");
  expect(robots).not.toMatch(/\/(fr|pt|es)\b/);
  const home = await (await request.get("/")).text();
  expect(home).not.toContain("hreflang");
});

test("text zoom to 200% does not cause horizontal scrolling on /partners", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/partners");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
