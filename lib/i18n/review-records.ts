import type { Locale } from "./config";

export type ReviewScope = "native-language" | "legal" | "tax-accounting" | "compliance";

export type ReviewRecord = {
  locale: Exclude<Locale, "en">;
  scope: ReviewScope;
  reviewer: string;
  qualification: string;
  /** ISO date (YYYY-MM-DD). */
  reviewedOn: string;
  /** Catalog and glossary versions reviewed. */
  glossaryVersion: string;
  outcome: "approved" | "approved-with-changes" | "rejected";
  /** Regional convention chosen by the reviewer, e.g. "pt-PT". Never decided by engineering. */
  regionalVariant?: string;
  unresolvedQuestions: readonly string[];
};

export const GLOSSARY_VERSION = "0.1.0-unreviewed";

/**
 * Append-only evidence that qualified people reviewed a locale. Entries must be added only from real,
 * attributable reviews. Empty means no review has been recorded; no locale may be promoted.
 */
export const REVIEW_RECORDS: readonly ReviewRecord[] = [];

export const REQUIRED_SCOPES: readonly ReviewScope[] = ["native-language", "legal", "tax-accounting", "compliance"];

export function isReviewComplete(locale: Exclude<Locale, "en">, records: readonly ReviewRecord[] = REVIEW_RECORDS): boolean {
  return REQUIRED_SCOPES.every(scope =>
    records.some(r => r.locale === locale && r.scope === scope && r.outcome !== "rejected" && r.reviewer.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(r.reviewedOn)),
  );
}
