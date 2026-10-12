import { describe, expect, it } from "vitest";
import { locales } from "@/lib/i18n/config";
import { isReviewComplete, REVIEW_RECORDS, REQUIRED_SCOPES, type ReviewRecord } from "@/lib/i18n/review-records";

describe("locale promotion gate", () => {
  it("never marks a locale supported without complete review records", () => {
    for (const [code, locale] of Object.entries(locales)) {
      if (code === "en") continue;
      if ((locale.status as string) === "supported") expect(isReviewComplete(code as "fr" | "pt" | "es"), code).toBe(true);
    }
  });

  it("currently has no recorded reviews, so fr, pt and es stay preview", () => {
    expect(REVIEW_RECORDS).toHaveLength(0);
    for (const code of ["fr", "pt", "es"] as const) {
      expect(locales[code].status).toBe("proposed");
      expect(isReviewComplete(code)).toBe(false);
    }
  });

  it("requires every scope, a named reviewer, a date and a non-rejected outcome", () => {
    const base = { locale: "fr", reviewer: "Example Reviewer", qualification: "x", reviewedOn: "2030-01-01", glossaryVersion: "1", outcome: "approved", unresolvedQuestions: [] } as const;
    const all: ReviewRecord[] = REQUIRED_SCOPES.map(scope => ({ ...base, scope }));
    expect(isReviewComplete("fr", all)).toBe(true);
    expect(isReviewComplete("fr", all.slice(1))).toBe(false);
    expect(isReviewComplete("fr", all.map((r, i) => (i === 0 ? { ...r, outcome: "rejected" as const } : r)))).toBe(false);
    expect(isReviewComplete("fr", all.map((r, i) => (i === 0 ? { ...r, reviewer: " " } : r)))).toBe(false);
    expect(isReviewComplete("pt", all)).toBe(false);
  });
});
