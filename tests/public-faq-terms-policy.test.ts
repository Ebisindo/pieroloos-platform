import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findMissingMessageKeys, messageCatalogs } from "@/lib/i18n/messages";
import { isPublicRoute } from "@/lib/navigation";
import { serializeFaqJsonLd } from "@/lib/seo/faq-json-ld";

describe("public FAQ and legal content", () => {
  it("keeps all current locale catalogs structurally aligned", () => {
    for (const [locale, catalog] of Object.entries(messageCatalogs)) {
      expect(findMissingMessageKeys(catalog), locale).toEqual([]);
    }
  });

  it("classifies FAQ, Terms and central policy directory as public without making unknown routes public", () => {
    expect(isPublicRoute("/faq")).toBe(true);
    expect(isPublicRoute("/terms")).toBe(true);
    expect(isPublicRoute("/policies")).toBe(true);
    expect(isPublicRoute("/policies/not-a-policy")).toBe(false);
  });

  it("renders the localized draft notice and preserves the required Terms safeguards", () => {
    const page = readFileSync(join(process.cwd(), "app/terms/page.tsx"), "utf8");
    const englishMessages = readFileSync(join(process.cwd(), "lib/i18n/messages/en.ts"), "utf8");
    expect(page).toContain('t("terms.draftNoticeTitle" as never)');
    expect(page).toContain('t("terms.draftNoticeBody" as never)');
    expect(englishMessages).toContain('"terms.draftNoticeTitle": "DRAFT — LEGAL REVIEW REQUIRED BEFORE PUBLICATION AS BINDING TERMS."');
    expect(englishMessages).toContain("operator's legal identity, registered address, effective date, governing law");
    const termsText = readFileSync(join(process.cwd(), "app/terms/page.tsx"), "utf8");
    expect(termsText).toContain("No liability cap or blanket exclusion is established by this draft.");
    expect(termsText).toContain("No governing law or dispute forum is selected by this draft.");
    expect(page).toContain('robots: { index: false, follow: true }');
  });

  it("generates FAQ structured data from the same question/answer data rendered by the page", () => {
    const content = readFileSync(join(process.cwd(), "app/faq/page.tsx"), "utf8");
    expect(content).toContain('const questions = faqSections.flatMap((section) => section.items);');
    expect(content).toContain('const structuredData = site ? serializeFaqJsonLd(questions) : null;');
    expect(content).toContain('{section.items.map(([question, answer])');
  });

  it("safely escapes FAQ text before embedding JSON-LD in a script element", () => {
    const hostileText = "</script><script>alert(1)</script>";
    const json = serializeFaqJsonLd([[hostileText, "Answer <tag> & content"]]);

    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c/script>");
    expect(JSON.parse(json)).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{
        "@type": "Question",
        name: hostileText,
        acceptedAnswer: { "@type": "Answer", text: "Answer <tag> & content" },
      }],
    });
  });

  it("marks policy document route metadata non-indexable while draft publication blockers remain", () => {
    const content = readFileSync(join(process.cwd(), "app/policies/[slug]/page.tsx"), "utf8");
    expect(content).toContain('robots: { index: false, follow: true }');
    expect(content).toContain("DRAFT — NOT APPROVED FOR BINDING OR FINAL PUBLICATION.");
    expect(content).toContain("Approval and implementation requirements");
  });
});
