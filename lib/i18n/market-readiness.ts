import type { MessageKey } from "@/lib/i18n/messages";

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export type StoredReadinessCheck = {
  key: string;
  title: string;
  status: string;
  summary: string;
  completed?: number;
  total?: number;
  nextSteps: string[];
};

const P = "marketEntry.readinessText.";
const PROFILE_FIELDS = [
  "business name", "business type", "business objective", "business model",
  "target market", "revenue model", "ownership context",
] as const;
const FIELD_KEYS: Record<(typeof PROFILE_FIELDS)[number], string> = Object.fromEntries(
  PROFILE_FIELDS.map((label) => [label, `${P}field.${label}`]),
) as never;

// Text is chosen from stable check keys/status codes and numeric counts; stored English text is the fallback.
export function localizeReadinessCheck(t: Translate, check: StoredReadinessCheck) {
  const has = (key: string) => key as MessageKey;
  const counts = { completed: check.completed ?? 0, total: check.total ?? 0 };
  const titleKey = `${P}title.${check.key}`;
  const title = isKnownTitle(check.key) ? t(has(titleKey)) : check.title;
  let summary = check.summary;
  let nextSteps = check.nextSteps;

  switch (check.key) {
    case "business-profile":
      summary = check.status === "COMPLETE"
        ? t(has(`${P}summary.business-profile.complete`))
        : t(has(`${P}summary.business-profile.missing`), { count: counts.total - counts.completed });
      nextSteps = check.nextSteps.map((step) => {
        const match = /^Complete: (.+)\.$/.exec(step);
        const labels = match?.[1].split(", ") ?? [];
        if (!match || !labels.every((label) => label in FIELD_KEYS)) return step;
        const fields = labels.map((label) => t(has(FIELD_KEYS[label as keyof typeof FIELD_KEYS]))).join(", ");
        return t(has(`${P}next.business-profile`), { fields });
      });
      break;
    case "formalization":
      summary = check.status === "NOT_CONFIGURED"
        ? t(has(`${P}summary.formalization.none`))
        : t(has(`${P}summary.formalization.progress`), counts);
      nextSteps = check.nextSteps.length
        ? [t(has(`${P}next.formalization.${check.status === "NOT_CONFIGURED" ? "none" : "continue"}`))]
        : [];
      break;
    case "obligations":
      summary = check.status === "NOT_CONFIGURED"
        ? t(has(`${P}summary.obligations.none`))
        : t(has(`${P}summary.obligations.progress`), counts);
      nextSteps = check.nextSteps.length
        ? [t(has(`${P}next.obligations.${check.status === "NOT_CONFIGURED" ? "none" : "open"}`))]
        : [];
      break;
    case "obligation-evidence":
      summary = counts.total > 0
        ? t(has(`${P}summary.obligation-evidence.progress`), counts)
        : t(has(`${P}summary.obligation-evidence.${check.status === "NOT_CONFIGURED" ? "unassessable" : "notRequired"}`));
      nextSteps = check.nextSteps.length ? [t(has(`${P}next.obligation-evidence`))] : [];
      break;
    case "professional-review": {
      const outcome = check.status === "COMPLETE" ? "APPROVED"
        : check.status === "NEEDS_INPUT" ? "CHANGES_REQUESTED" : "REVIEW_REQUIRED";
      summary = t(has(`${P}summary.professional-review.${outcome}`));
      nextSteps = check.nextSteps.length ? [t(has(`${P}next.professional-review.${outcome === "APPROVED" ? "REVIEW_REQUIRED" : outcome}`))] : [];
      break;
    }
    case "cross-border-operations":
      summary = t(has(`${P}summary.cross-border-operations`));
      nextSteps = check.nextSteps.length ? [t(has(`${P}next.cross-border-operations`))] : [];
      break;
  }
  return { title, summary, nextSteps };
}

const KNOWN_TITLES = ["business-profile", "formalization", "obligations", "obligation-evidence", "professional-review", "cross-border-operations"];
function isKnownTitle(key: string) { return KNOWN_TITLES.includes(key); }

const ENGLISH_BOUNDARY = "This is an internal preparation checklist, not a legal, tax, regulatory, banking, licensing, market-suitability, or transaction approval. Recorded data may be incomplete or out of date.";

export function localizeReadinessBoundary(t: Translate, boundary: string) {
  return boundary === ENGLISH_BOUNDARY ? t(`${P}boundary` as MessageKey) : boundary;
}
