import { describe, expect, it } from "vitest";
import {
  AFRICAN_JURISDICTION_COVERAGE,
  isActiveJurisdictionSource,
  resolveActiveRules,
  summarizeAuthorityCoverage,
  type AuthoritativeSource,
  type JurisdictionRule,
} from "@/lib/domain/jurisdiction";

describe("jurisdiction intelligence layer", () => {
  it("tracks authoritative metadata and activation status", () => {
    const source: AuthoritativeSource = {
      id: "source-ng-01",
      jurisdictionId: "ng-nigeria",
      jurisdictionCode: "NG",
      title: "Companies and Allied Matters Act, 2020",
      sourceType: "STATUTE",
      issuingAuthority: "Federal Republic of Nigeria",
      publicationDate: new Date("2020-06-01T00:00:00.000Z"),
      effectiveDate: new Date("2020-06-01T00:00:00.000Z"),
      retrievalDate: new Date("2026-03-01T00:00:00.000Z"),
      confidence: 95,
      evidenceClass: "E4",
      reviewerUserId: "reviewer-1",
      reviewStatus: "VERIFIED",
      supersessionState: "ACTIVE",
      notes: "Primary governance source for company formation.",
    };

    expect(isActiveJurisdictionSource(source, new Date("2026-10-01T00:00:00.000Z"))).toBe(true);
  });

  it("deactivates superseded and draft rules while keeping active rules available", () => {
    const rules: JurisdictionRule[] = [
      {
        id: "rule-1",
        jurisdictionId: "ng-nigeria",
        sourceId: "source-ng-01",
        title: "Company formation registration",
        effectiveDate: new Date("2020-01-01T00:00:00.000Z"),
        publicationDate: new Date("2020-01-01T00:00:00.000Z"),
        retrievalDate: new Date("2026-03-01T00:00:00.000Z"),
        confidence: 92,
        evidenceClass: "E4",
        reviewerUserId: "reviewer-1",
        supersessionState: "ACTIVE",
        active: true,
      },
      {
        id: "rule-2",
        jurisdictionId: "ng-nigeria",
        sourceId: "source-ng-02",
        title: "Legacy licensing rule",
        effectiveDate: new Date("2018-01-01T00:00:00.000Z"),
        publicationDate: new Date("2018-01-01T00:00:00.000Z"),
        retrievalDate: new Date("2026-03-01T00:00:00.000Z"),
        confidence: 65,
        evidenceClass: "E2",
        reviewerUserId: "reviewer-2",
        supersessionState: "SUPERSEDED",
        active: true,
      },
      {
        id: "rule-3",
        jurisdictionId: "gh-ghana",
        sourceId: "source-gh-01",
        title: "Draft tax guidance",
        publicationDate: new Date("2026-06-01T00:00:00.000Z"),
        retrievalDate: new Date("2026-03-01T00:00:00.000Z"),
        confidence: 55,
        evidenceClass: "E2",
        reviewerUserId: "reviewer-3",
        supersessionState: "DRAFT",
        active: true,
      },
    ];

    const activeRules = resolveActiveRules(rules, new Date("2026-10-01T00:00:00.000Z"));
    expect(activeRules.map((rule) => rule.id)).toEqual(["rule-1"]);
  });

  it("covers key African jurisdictions for progressive authority build-out", () => {
    expect(AFRICAN_JURISDICTION_COVERAGE.map((entry) => entry.code)).toEqual([
      "NG",
      "GH",
      "KE",
      "RW",
      "ZA",
      "CI",
    ]);

    const summary = summarizeAuthorityCoverage([
      { jurisdictionId: "ng-nigeria", supersessionState: "ACTIVE", effectiveDate: new Date("2020-01-01T00:00:00.000Z") },
      { jurisdictionId: "ng-nigeria", supersessionState: "SUPERSEDED", publicationDate: new Date("2018-01-01T00:00:00.000Z") },
      { jurisdictionId: "ke-kenya", supersessionState: "ACTIVE", publicationDate: new Date("2024-04-01T00:00:00.000Z") },
    ]);

    expect(summary.total).toBe(3);
    expect(summary.active).toBe(2);
    expect(summary.superseded).toBe(1);
    expect(summary.byJurisdiction["ng-nigeria"]).toBe(2);
  });
});
