import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTranslator, messageCatalogs, type MessageKey } from "@/lib/i18n/messages";
import { ENGAGEMENT_STATUSES } from "@/lib/domain/engagement";
import { MARKET_ENTRY_REVIEW_STATUSES, MARKET_ENTRY_STATUSES } from "@/lib/domain/market-entry";

const nonEnglish = ["fr", "pt", "es"] as const;
const keysFor = (prefix: string) =>
  (Object.keys(messageCatalogs.en) as MessageKey[]).filter((key) => key.startsWith(prefix));

// Values that are legitimately identical across languages (cognates, units).
const sharedValues = new Set([
  "Client", "Version {version}", "Pause", "Cliente", "Empresa", "Pausar", "Planification", "Action",
  "Documentation", "Archivé", "Cancelado", "Archivado", "Nota de revisión: {note}",
]);

describe("application screens translated in the quality audit", () => {
  const prefixes = ["access.", "boot.", "workspace.", "engagements.", "expansion.", "marketEntry.", "crossBorder.", "controlPlane."];

  it("translates every new key in fr, pt and es without copying English", () => {
    for (const prefix of prefixes) {
      for (const key of keysFor(prefix)) {
        for (const locale of nonEnglish) {
          const value = messageCatalogs[locale][key];
          const english = messageCatalogs.en[key];
          if (value === english && !sharedValues.has(english)) {
            throw new Error(`${locale}:${key} is identical to English`);
          }
        }
      }
    }
  });

  it("has a label for every machine status value shown in the UI", () => {
    for (const status of ENGAGEMENT_STATUSES) expect(messageCatalogs.en[`engagements.status.${status}`]).toBeTruthy();
    for (const status of MARKET_ENTRY_STATUSES) expect(messageCatalogs.en[`marketEntry.status.${status}`]).toBeTruthy();
    for (const status of MARKET_ENTRY_REVIEW_STATUSES) expect(messageCatalogs.en[`marketEntry.reviewStatus.${status}`]).toBeTruthy();
    for (const status of ["PREPARING", "REVIEWED", "CHANGES_REQUESTED", "ARCHIVED"]) {
      expect(messageCatalogs.en[`crossBorder.status.${status}` as MessageKey]).toBeTruthy();
    }
    for (const status of ["NOT_ASSESSED", "IN_PROGRESS", "COMPLETE", "NOT_APPLICABLE"]) {
      expect(messageCatalogs.en[`crossBorder.controlStatus.${status}` as MessageKey]).toBeTruthy();
    }
  });

  it("interpolates values and keeps the boundary disclaimers present in every locale", () => {
    for (const locale of nonEnglish) {
      const t = createTranslator(locale);
      expect(t("marketEntry.plan.version", { version: 3 })).toContain("3");
      expect(t("crossBorder.controls.title", { count: 2 })).toContain("2");
      expect(t("expansion.boundary").length).toBeGreaterThan(80);
      expect(t("crossBorder.boundary").length).toBeGreaterThan(80);
    }
  });

  it("no longer hardcodes English UI copy in the translated components", () => {
    const files = [
      "components/market-entry/MarketEntryWorkflow.tsx",
      "components/cross-border/CrossBorderDossierWorkflow.tsx",
      "components/auth/WorkspaceAccessState.tsx",
      "components/engagement/ActivityTimeline.tsx",
      "components/workspace/WorkspaceSelector.tsx",
      "components/shell/BootLayer.tsx",
      "app/expansion/page.tsx",
      "app/cross-border/page.tsx",
      "app/engagements/page.tsx",
      "app/engagements/[id]/page.tsx",
    ];
    const forbidden = [
      "Market-entry pathways", "Cross-border preparation", "Create pathway", "Create dossier", "Assess readiness",
      "Request changes", "Record review", "Attach evidence", "Operational History", "Activity Timeline",
      "WORKSPACE ACCESS", "SYSTEM READY", "Select a workspace", "No activity has been recorded",
      "Value not recorded", "Preparation controls",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const phrase of forbidden) expect(source, `${file}: ${phrase}`).not.toContain(phrase);
    }
  });

  it("does not use browser-default locale formatting in translated components", () => {
    for (const file of ["components/market-entry/MarketEntryWorkflow.tsx", "components/engagement/ActivityTimeline.tsx"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/toLocale(Date|Time)?String\(\)/);
    }
  });
});
