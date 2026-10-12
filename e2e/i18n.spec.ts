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
