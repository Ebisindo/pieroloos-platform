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
    expect(content).toContain('t("terms.draftNoticeTitle" as never)');
    expect(readFileSync(join(process.cwd(), "lib/i18n/messages/en.ts"), "utf8")).toContain("DRAFT — LEGAL REVIEW REQUIRED BEFORE PUBLICATION AS BINDING TERMS.");
    const englishMessages = readFileSync(join(process.cwd(), "lib/i18n/messages/en.ts"), "utf8");
    expect(englishMessages).toContain("DRAFT — LEGAL REVIEW REQUIRED BEFORE PUBLICATION AS BINDING TERMS.");
    expect(englishMessages).toContain("operator\'s legal identity, registered address, effective date, governing law");
    expect(content).toContain("No liability cap or blanket exclusion is established by this draft.");
    expect(content).toContain("No governing law or dispute forum is selected by this draft.");
  });

  it("only emits FAQ structured data generated from the question/answer data rendered by the page", () => {
    const content = readFileSync(join(process.cwd(), "app/faq/page.tsx"), "utf8");
    expect(content).toContain('const questions = faqSections.flatMap((section) => section.items);');
    expect(content).toContain('mainEntity: questions.map(([question, answer])');
    expect(content).toContain(String.raw`.replace(/</g, "\\u003c")`);
    expect(content).toContain('{section.items.map(([question, answer])');
  });

  it("marks policy document route metadata non-indexable while draft publication blockers remain", () => {
    const content = readFileSync(join(process.cwd(), "app/policies/[slug]/page.tsx"), "utf8");
    expect(content).toContain('robots: { index: false, follow: true }');
    expect(content).toContain("DRAFT — NOT APPROVED FOR BINDING OR FINAL PUBLICATION.");
    expect(content).not.toContain("Approval and implementation requirements");
    const audit = readFileSync(join(process.cwd(), "docs/POLICY-GOVERNANCE-AUDIT.md"), "utf8");
    expect(audit).toContain("Internal legal and operational publication checklist");
  });
});
