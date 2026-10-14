import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findMissingMessageKeys, messageCatalogs } from "@/lib/i18n/messages";
import { isPublicRoute } from "@/lib/navigation";

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

  it("keeps draft notice and the required sections in Terms", () => {
    const content = readFileSync(join(process.cwd(), "app/terms/page.tsx"), "utf8");
    expect(content).toContain("DRAFT — LEGAL REVIEW REQUIRED BEFORE PUBLICATION AS BINDING TERMS.");
    expect(content).toContain("operator's legal identity, registered address, effective date, governing law");
    expect(content).toContain("No liability cap or blanket exclusion is established by this draft.");
    expect(content).toContain("No governing law or dispute forum is selected by this draft.");
  });

  it("only emits FAQ structured data generated from the question/answer data rendered by the page", () => {
    const content = readFileSync(join(process.cwd(), "app/faq/page.tsx"), "utf8");
    expect(content).toContain('const questions = faqSections.flatMap((section) => section.items);');
    expect(content).toContain('mainEntity: questions.map(([question, answer])');
    expect(content).toContain('.replace(/</g, "\\u003c")');
    expect(content).toContain('{section.items.map(([question, answer])');
  });

  it("marks policy document route metadata non-indexable while draft publication blockers remain", () => {
    const content = readFileSync(join(process.cwd(), "app/policies/[slug]/page.tsx"), "utf8");
    expect(content).toContain('robots: { index: false, follow: true }');
    expect(content).toContain("DRAFT — NOT APPROVED FOR BINDING OR FINAL PUBLICATION.");
    expect(content).toContain("Approval and implementation requirements");
  });
});
