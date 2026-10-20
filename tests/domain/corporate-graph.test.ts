import { describe, expect, it } from "vitest";
import type { CorporateGraphRelationType } from "@prisma/client";
import {
  assessComplianceRule,
  layoutCorporateGraph,
  validateGraphEdge,
  validateOwnershipTotal,
  wouldCreateOwnershipCycle,
} from "@/lib/domain/corporate-graph";

describe("corporate graph layout", () => {
  it("returns no points for an empty graph", () => {
    expect(layoutCorporateGraph([]).points).toEqual([]);
  });

  it("uses stable positions for the same node IDs regardless of input order", () => {
    const nodes = [{ id: "c" }, { id: "a" }, { id: "b" }];
    expect(layoutCorporateGraph(nodes)).toEqual(layoutCorporateGraph([...nodes].reverse()));
  });

  it("assigns unique, in-bounds coordinates to distinct graph nodes", () => {
    const layout = layoutCorporateGraph(
      Array.from({ length: 18 }, (_, index) => ({ id: `node-${index.toString().padStart(2, "0")}` })),
    );
    const positions = layout.points.map(({ x, y }) => `${x}:${y}`);
    expect(new Set(positions).size).toBe(layout.points.length);
    expect(layout.points.every(({ x, y }) => x >= 0 && x <= layout.width && y >= 0 && y <= layout.height)).toBe(true);
  });

  it("rejects invalid canvas dimensions", () => {
    expect(() => layoutCorporateGraph([], 200)).toThrow("Graph width");
    expect(() => layoutCorporateGraph([], 1000, 200)).toThrow("Graph height");
  });
});

describe("corporate graph relationship guardrails", () => {
  it("rejects self relationships", () => {
    expect(validateGraphEdge({ fromNodeId: "a", toNodeId: "a", relation: "OWNS" })).toContain("cannot be related");
  });

  it("rejects invalid ownership percentages", () => {
    expect(validateGraphEdge({ fromNodeId: "a", toNodeId: "b", relation: "OWNS", ownershipPercent: 101 })).toContain("between 0 and 100");
  });

  it("rejects ownership percentages for non-ownership relationships", () => {
    expect(validateGraphEdge({ fromNodeId: "a", toNodeId: "b", relation: "BANKS_WITH", ownershipPercent: 25 })).toContain("only valid for OWNS");
    expect(validateGraphEdge({ fromNodeId: "a", toNodeId: "b", relation: "BANKS_WITH" })).toBeNull();
  });

  it("rejects recorded direct ownership totals above 100 percent", () => {
    const existing = [
      { toNodeId: "entity", relation: "OWNS" as const, ownershipPercent: 60 },
      { toNodeId: "entity", relation: "OWNS" as const, ownershipPercent: 25 },
    ];
    expect(validateOwnershipTotal(existing, {
      fromNodeId: "owner-3", toNodeId: "entity", relation: "OWNS", ownershipPercent: 20,
    })).toContain("cannot total more than 100%");
  });

  it("does not aggregate percentages for another entity or another relationship type", () => {
    const existing: Array<{ toNodeId: string; relation: CorporateGraphRelationType; ownershipPercent: number | null }> = [
      { toNodeId: "other-entity", relation: "OWNS", ownershipPercent: 90 },
      { toNodeId: "entity", relation: "CONTROLS", ownershipPercent: null },
    ];
    expect(validateOwnershipTotal(existing, {
      fromNodeId: "owner", toNodeId: "entity", relation: "OWNS", ownershipPercent: 90,
    })).toBeNull();
  });

  it("detects ownership cycles", () => {
    const edges: Array<{ fromNodeId: string; toNodeId: string; relation: CorporateGraphRelationType }> = [
      { fromNodeId: "a", toNodeId: "b", relation: "OWNS" },
      { fromNodeId: "b", toNodeId: "c", relation: "OWNS" },
    ];
    expect(wouldCreateOwnershipCycle(edges, { fromNodeId: "c", toNodeId: "a", relation: "OWNS" })).toBe(true);
  });

  it("ignores non-ownership links for ownership-cycle checks", () => {
    expect(wouldCreateOwnershipCycle([], { fromNodeId: "a", toNodeId: "b", relation: "BANKS_WITH" })).toBe(false);
  });
});

describe("evidence-governed compliance assessment", () => {
  const base = {
    id: "r1",
    jurisdictionCode: "NG",
    entityType: "COMPANY",
    ruleKey: "example",
    title: "Illustrative rule",
    description: null,
    frequency: null,
    severity: "MEDIUM",
    sourceTitle: "Official source",
    sourceUrl: "https://example.gov",
    sourceAuthority: "Authority",
    sourceRetrievedAt: new Date("2026-01-01T00:00:00.000Z"),
    effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
    effectiveTo: null,
    evidenceClass: "E3" as const,
    reviewStatus: "VERIFIED" as const,
    requiresProfessionalReview: false,
    active: true,
    version: 1,
  };

  it("recognises complete evidence metadata", () => {
    const assessment = assessComplianceRule(base, new Date("2026-10-01T00:00:00.000Z"));
    expect(assessment.sourceReady).toBe(true);
    expect(assessment.professionalReviewRequired).toBe(false);
  });

  it("requires review when source is not verified", () => {
    const assessment = assessComplianceRule(
      { ...base, reviewStatus: "UNREVIEWED" },
      new Date("2026-10-01T00:00:00.000Z"),
    );
    expect(assessment.sourceReady).toBe(false);
    expect(assessment.professionalReviewRequired).toBe(true);
    expect(assessment.gaps).toContain("SOURCE_NOT_VERIFIED");
  });
});
