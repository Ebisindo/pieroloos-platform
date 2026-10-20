import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE, getLocale, isLocale, locales } from "@/lib/i18n/config";
import { createTranslator, findMissingMessageKeys, formatCurrency, formatDate, formatNumber, messageCatalogs } from "@/lib/i18n/messages";

describe("internationalization catalogs", () => {
  it("uses English by default and rejects unsupported locale values", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(getLocale(undefined)).toBe("en");
    expect(getLocale("unsupported")).toBe("en");
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("fr-CA")).toBe(false);
    expect(Object.keys(locales)).toEqual(["en", "fr", "pt", "es"]);
  });

  it("provides complete catalogs for every configured locale", () => {
    for (const [locale, catalog] of Object.entries(messageCatalogs)) {
      expect(findMissingMessageKeys(catalog), `${locale} missing keys`).toEqual([]);
    }
  });

  it("keeps unreviewed locales in preview status", () => {
    expect(locales.en.status).toBe("default");
    expect(locales.fr.status).toBe("proposed");
    expect(locales.pt.status).toBe("proposed");
    expect(locales.es.status).toBe("proposed");
  });

  it("detects missing keys and falls back to English without dropping interpolation", () => {
    expect(findMissingMessageKeys({ "language.select": "Choisir une langue" })).toContain("form.submit");

    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const t = createTranslator("fr", {});
    expect(t("language.select")).toBe("Select language");
    expect(t("form.messageHint", { count: 7, max: 4000 })).toBe(
      "7 / 4000. Do not include confidential or personal data beyond what is needed.",
    );
    expect(warning).toHaveBeenCalled();
    warning.mockRestore();
  });

  it("interpolates translated messages without modifying workflow values", () => {
    expect(createTranslator("es")("form.messageHint", { count: 12, max: 4000 })).toContain("12 / 4000.");
    expect(createTranslator("pt")("form.messageHint", { count: 12, max: 4000 })).toContain("12 / 4000.");
    expect(createTranslator("fr")("form.messageHint", { count: 12, max: 4000 })).toContain("12 / 4000.");
  });

  it("provides translated copy for the connected application workflows", () => {
    const keys = [
      "signin.title",
      "app.clients.portalTitle",
      "app.intake.title",
      "app.jurisdiction.title",
      "app.formation.pageDescription",
      "app.compliance.create",
      "app.reports.title",
      "app.dashboard.operationalActions",
      "app.settings.defaults",
      "app.portal.collaborationTitle",
    ] as const;

    for (const locale of ["fr", "pt", "es"] as const) {
      const translate = createTranslator(locale);
      for (const key of keys) {
        expect(translate(key), `${locale}:${key}`).not.toBe(messageCatalogs.en[key]);
      }
    }
  });

  it("keeps the Spanish public secondary action localized", () => {
    expect(createTranslator("es")("home.hero.secondaryAction")).toBe("Explorar PieroloOS");
  });

  it("formats numbers, dates, and currencies using the selected locale", () => {
    expect(formatNumber(1234.5, "fr")).not.toBe(formatNumber(1234.5, "en"));
    expect(formatDate(new Date("2026-10-11T12:00:00Z"), "fr")).not.toBe(
      formatDate(new Date("2026-10-11T12:00:00Z"), "en"),
    );
    expect(formatCurrency(1250, "NGN", "fr")).not.toBe(formatCurrency(1250, "NGN", "en"));
  });

  it("keeps interpolation placeholders consistent across catalogs", () => {
    const keys = Object.keys(messageCatalogs.en) as (keyof typeof messageCatalogs.en)[];
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    for (const locale of ["fr", "pt", "es"] as const) {
      for (const key of keys) {
        expect(placeholders(messageCatalogs[locale][key]), `${locale}:${key}`).toEqual(
          placeholders(messageCatalogs.en[key]),
        );
      }
    }
  });
});
