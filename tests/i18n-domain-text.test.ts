import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessMarketReadiness, type MarketEntryReviewStatus } from "@/lib/domain/market-entry";
import { EVIDENCE_GAP_CODES, EVIDENCE_GAP_LABELS, PLATFORM_GUIDANCE_NOTICE } from "@/lib/domain/trust-boundary";
import { KNOWN_API_ERROR_MESSAGES, localizeApiError } from "@/lib/i18n/api-errors";
import { localizeReadinessBoundary, localizeReadinessCheck } from "@/lib/i18n/market-readiness";
import { createTranslator, messageCatalogs, type MessageKey } from "@/lib/i18n/messages";

const nonEnglish = ["fr", "pt", "es"] as const;
const keysFor = (prefix: string) =>
  (Object.keys(messageCatalogs.en) as MessageKey[]).filter((key) => key.startsWith(prefix));

const fullProfile = {
  businessName: "A", businessType: "B", businessObjective: "C", businessModel: "D",
  targetMarket: "E", revenueModel: "F", ownershipContext: "G",
};
const scenarios: Array<Parameters<typeof assessMarketReadiness>[0]> = [
  { profile: { ...fullProfile, ownershipContext: null, businessModel: "" }, formationPlan: null, obligations: [], reviewStatus: "NOT_REQUESTED" as MarketEntryReviewStatus },
  {
    profile: fullProfile,
    formationPlan: { taskStatuses: ["COMPLETED", "PENDING"], taskCount: 2 },
    obligations: [
      { status: "OPEN", requiresEvidence: true, evidenceCount: 0 },
      { status: "COMPLIANT", requiresEvidence: true, evidenceCount: 1 },
    ],
    reviewStatus: "CHANGES_REQUESTED" as MarketEntryReviewStatus,
  },
  {
    profile: fullProfile,
    formationPlan: { taskStatuses: ["COMPLETED"], taskCount: 1 },
    obligations: [{ status: "COMPLETE", requiresEvidence: false, evidenceCount: 0 }],
    reviewStatus: "APPROVED" as MarketEntryReviewStatus,
  },
];

describe("domain and API-originated text is localized for display only", () => {
  it("translates trust-boundary, signal, classification, API error and readiness keys", () => {
    const prefixes = ["trust.", "signals.", "intake.classification.", "apiError.", "marketEntry.readinessText."];
    const shared = new Set(["Information", "Attention"]);
    for (const prefix of prefixes) {
      for (const key of keysFor(prefix)) {
        for (const locale of nonEnglish) {
          const value = messageCatalogs[locale][key];
          const english = messageCatalogs.en[key];
          if (value === english && !shared.has(english)) throw new Error(`${locale}:${key} is identical to English`);
        }
      }
    }
  });

  it("keeps the English catalog identical to the domain trust-boundary constants", () => {
    expect(messageCatalogs.en["trust.notice"]).toBe(PLATFORM_GUIDANCE_NOTICE);
    for (const code of EVIDENCE_GAP_CODES) {
      expect(messageCatalogs.en[`trust.gap.${code}` as MessageKey]).toBe(EVIDENCE_GAP_LABELS[code]);
      for (const locale of nonEnglish) expect(messageCatalogs[locale][`trust.gap.${code}` as MessageKey]).toBeTruthy();
    }
  });

  it("preserves the not-advice qualification in every locale", () => {
    const markers = { fr: /conseil juridique/, pt: /aconselhamento jur/, es: /asesoramiento jur/ };
    for (const locale of nonEnglish) {
      expect(messageCatalogs[locale]["trust.notice"]).toMatch(markers[locale]);
      expect(messageCatalogs[locale]["marketEntry.readinessText.boundary"].length).toBeGreaterThan(100);
    }
  });

  it("maps every known API error to a catalog entry and passes unknown messages through", () => {
    for (const message of KNOWN_API_ERROR_MESSAGES) {
      const fr = createTranslator("fr");
      const localized = localizeApiError(fr, message, "fallback");
      if (!message.startsWith("Dossier changed. Refresh") && localized === message) {
        throw new Error(`API error not localized for fr: ${message}`);
      }
    }
    const t = createTranslator("es");
    expect(localizeApiError(t, "Authentication required.", "x")).toBe("Se requiere autenticación.");
    expect(localizeApiError(t, "Some new server message.", "x")).toBe("Some new server message.");
    expect(localizeApiError(t, undefined, "fallback")).toBe("fallback");
  });

  it("covers every shared API error emitted by routes with a high repeat count", () => {
    const required = ["Authentication required.", "Select an active workspace.", "Invalid request origin.", "Invalid request body."];
    for (const message of required) expect(KNOWN_API_ERROR_MESSAGES).toContain(message);
  });

  it("reproduces stored English readiness text exactly in the English locale", () => {
    const t = createTranslator("en");
    for (const input of scenarios) {
      const readiness = assessMarketReadiness(input);
      for (const check of readiness.checks) {
        const text = localizeReadinessCheck(t, check);
        expect(text.title, check.key).toBe(check.title);
        expect(text.summary, check.key).toBe(check.summary);
        expect(text.nextSteps, check.key).toEqual(check.nextSteps);
      }
      expect(localizeReadinessBoundary(t, readiness.boundary)).toBe(readiness.boundary);
    }
  });

  it("localizes readiness text in fr, pt and es without leaving placeholders or English", () => {
    for (const locale of nonEnglish) {
      const t = createTranslator(locale);
      for (const input of scenarios) {
        const readiness = assessMarketReadiness(input);
        for (const check of readiness.checks) {
          const text = localizeReadinessCheck(t, check);
          expect(text.title, `${locale}:${check.key}`).not.toBe(check.title);
          expect(text.summary, `${locale}:${check.key}`).not.toBe(check.summary);
          for (const value of [text.title, text.summary, ...text.nextSteps]) expect(value).not.toMatch(/\{\w+\}/);
          check.nextSteps.forEach((step, index) => expect(text.nextSteps[index]).not.toBe(step));
        }
        expect(localizeReadinessBoundary(t, readiness.boundary)).not.toBe(readiness.boundary);
      }
    }
  });

  it("falls back to stored text for unknown checks, steps and boundaries", () => {
    const t = createTranslator("fr");
    const unknown = { key: "future-check", title: "Future", status: "NEEDS_INPUT", summary: "Stored summary.", nextSteps: ["Stored step."] };
    expect(localizeReadinessCheck(t, unknown)).toEqual({ title: "Future", summary: "Stored summary.", nextSteps: ["Stored step."] });
    expect(localizeReadinessBoundary(t, "Custom boundary.")).toBe("Custom boundary.");
  });

  it("does not hardcode English copy or locale-unaware dates in the translated support components", () => {
    const files: Record<string, RegExp[]> = {
      "components/evidence/TrustBoundaryNotice.tsx": [/Platform guidance|Information boundary/],
      "components/audit/AuditTimeline.tsx": [/toLocale(Date|Time)?String\(/],
      "components/ui/IntakeClassificationLegend.tsx": [/>\s*(FACT|ASSUMPTION|UNRESOLVED)\s*</],
      "components/compliance/EvidenceSignalList.tsx": [/No evidence control signals/],
      "components/control-plane/ActionStatusBadge.tsx": [/replaceAll/],
    };
    for (const [file, patterns] of Object.entries(files)) {
      const source = readFileSync(file, "utf8");
      for (const pattern of patterns) expect(source, file).not.toMatch(pattern);
    }
  });
});
