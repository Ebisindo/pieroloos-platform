import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KNOWN_API_ERROR_MESSAGES, localizeApiError } from "@/lib/i18n/api-errors";
import { locales } from "@/lib/i18n/config";
const LOCALES = Object.keys(locales) as Array<keyof typeof locales>;
import { createTranslator, messageCatalogs, type MessageKey } from "@/lib/i18n/messages";
import { evidenceClassLabel } from "@/lib/domain/evidence";

const placeholders = (v: string) => [...v.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");
const keys = Object.keys(messageCatalogs.en) as MessageKey[];

describe("catalog consistency", () => {
  it("has identical keys and interpolation placeholders in every locale", () => {
    for (const locale of LOCALES) {
      const catalog = messageCatalogs[locale] as Record<string, string>;
      expect(Object.keys(catalog).sort()).toEqual([...keys].sort());
      for (const key of keys) expect(placeholders(catalog[key]), `${locale}:${key}`).toBe(placeholders(messageCatalogs.en[key]));
    }
  });
});

describe("evidence components", () => {
  it("translates evidence panel keys in preview locales", () => {
    for (const key of keys.filter(k => k.startsWith("evidencePanel."))) {
      for (const l of ["fr", "pt", "es"] as const) {
        const cognate = key === "evidencePanel.documents" && l === "fr";
        if (!cognate) expect(messageCatalogs[l][key], `${l}:${key}`).not.toBe(messageCatalogs.en[key]);
      }
    }
  });
  it("keeps English class labels aligned with the domain", () => {
    for (const c of ["E0", "E1", "E2", "E3", "E4"] as const) {
      expect(messageCatalogs.en[`evidencePanel.class.${c}` as MessageKey]).toBe(evidenceClassLabel(c));
    }
  });
  it("has no hardcoded English in the components", () => {
    for (const f of ["DocumentEvidencePanel", "EvidenceBadge"]) {
      const src = readFileSync(`components/evidence/${f}.tsx`, "utf8");
      expect(src).toContain("useLocale");
      expect(src).not.toMatch(/>\s*(Evidence intelligence|Persistent evidence record|Missing:|Warning:)/);
    }
  });
});

describe("API error localization", () => {
  it("maps every known error to a translated key", () => {
    for (const message of KNOWN_API_ERROR_MESSAGES) {
      for (const l of ["fr", "pt", "es"] as const) {
        const t = createTranslator(l);
        expect(localizeApiError(t, message, "FALLBACK"), `${l}:${message}`).not.toBe(message);
      }
    }
  });
  it("falls back to the original message when unmapped and to the fallback when empty", () => {
    const t = createTranslator("fr");
    expect(localizeApiError(t, "Worker queue exploded", "x")).toBe("Worker queue exploded");
    expect(localizeApiError(t, undefined, "x")).toBe("x");
  });
  it("does not map operational or internal messages", () => {
    for (const m of ["Storage is unavailable.", "Notification worker batch failed."]) {
      expect(KNOWN_API_ERROR_MESSAGES).not.toContain(m);
    }
  });
});

describe("validation messages", () => {
  it("interpolates field and message", () => {
    for (const l of LOCALES) {
      const out = createTranslator(l)("validation.field", { field: "email", message: "bad" });
      expect(out).toContain("email");
      expect(out).toContain("bad");
    }
  });
});
