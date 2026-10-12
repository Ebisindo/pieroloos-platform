import { describe, expect, it } from "vitest";
import { GLOSSARY, GLOSSARY_REVIEW_STATUS } from "@/lib/i18n/glossary";
import { messageCatalogs, type MessageKey } from "@/lib/i18n/messages";

const targets = ["fr", "pt", "es"] as const;
const keys = Object.keys(messageCatalogs.en) as MessageKey[];

describe("controlled legal/compliance glossary", () => {
  it("is explicitly recorded as unreviewed", () => {
    expect(GLOSSARY_REVIEW_STATUS).toBe("unreviewed");
  });

  for (const entry of GLOSSARY) {
    for (const locale of targets) {
      it(`${entry.id} (${locale}) avoids disallowed variants`, () => {
        for (const key of keys) {
          if (!entry.sourcePattern.test(messageCatalogs.en[key])) continue;
          expect(messageCatalogs[locale][key], `${locale}:${key}`).not.toMatch(entry.disallowed[locale]);
        }
      });
      it(`${entry.id} (${locale}) uses the approved term in the sensitive keys that name it`, () => {
        const exact = keys.filter(k => k.startsWith("apiError.") && new RegExp(`\\b${entry.source}\\b`, "i").test(messageCatalogs.en[k]));
        for (const key of exact) {
          expect(messageCatalogs[locale][key], `${locale}:${key}`).toMatch(entry.preferredPattern[locale]);
        }
      });
    }
  }
});
