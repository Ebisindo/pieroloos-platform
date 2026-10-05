import { describe, expect, it } from "vitest";
import {
  assessMarketReadiness,
  canTransitionMarketEntry,
} from "@/lib/domain/market-entry";

const profile = {
  businessName: "Example Trading",
  businessType: "Private company",
  businessObjective: "Regional distribution",
  businessModel: "Wholesale distribution",
  targetMarket: "East Africa",
  revenueModel: "Product sales",
  ownershipContext: "Privately held",
};

describe("market entry and cross-border readiness", () => {
  it("identifies profile gaps and does not treat absent records as completed checks", () => {
    const result = assessMarketReadiness({
      profile: { ...profile, ownershipContext: null },
      formationPlan: null,
      obligations: [],
      reviewStatus: "PENDING",
      assessedAt: new Date("2026-10-05T12:00:00.000Z"),
    });

    expect(result.status).toBe("PREPARATION_INCOMPLETE");
    expect(result.checks.find((check) => check.key === "business-profile")).toMatchObject({
      status: "NEEDS_INPUT",
      nextSteps: ["Complete: ownership context."],
    });
    expect(result.checks.find((check) => check.key === "formalization")?.status).toBe("NOT_CONFIGURED");
    expect(result.checks.find((check) => check.key === "obligations")?.status).toBe("NOT_CONFIGURED");
    expect(result.checks.find((check) => check.key === "cross-border-operations")?.status).toBe("NOT_ASSESSED");
  });

  it("does not report evidence coverage when a required evidence item is missing", () => {
    const result = assessMarketReadiness({
      profile,
      formationPlan: { taskStatuses: ["COMPLETED", "WAIVED"], taskCount: 2 },
      obligations: [{ status: "COMPLETE", requiresEvidence: true, evidenceCount: 0 }],
      reviewStatus: "PENDING",
    });

    expect(result.status).toBe("PREPARATION_INCOMPLETE");
    expect(result.checks.find((check) => check.key === "obligation-evidence")).toMatchObject({
      status: "NEEDS_INPUT",
      summary: "0 of 1 evidence-requiring obligations have linked evidence.",
    });
  });

  it("records review and preparation outcomes separately from transaction readiness", () => {
    const result = assessMarketReadiness({
      profile,
      formationPlan: { taskStatuses: ["COMPLETED"], taskCount: 1 },
      obligations: [{ status: "COMPLIANT", requiresEvidence: true, evidenceCount: 1 }],
      reviewStatus: "APPROVED",
    });

    expect(result.status).toBe("REVIEW_RECORDED");
    expect(result.checks.find((check) => check.key === "professional-review")?.status).toBe("COMPLETE");
    expect(result.checks.find((check) => check.key === "cross-border-operations")?.status).toBe("NOT_ASSESSED");
    expect(result.boundary).toContain("not a legal, tax");
  });

  it("allows only explicit market-entry lifecycle transitions", () => {
    expect(canTransitionMarketEntry("ASSESSING", "IN_PROGRESS")).toBe(true);
    expect(canTransitionMarketEntry("PAUSED", "ASSESSING")).toBe(true);
    expect(canTransitionMarketEntry("ASSESSING", "COMPLETED")).toBe(false);
    expect(canTransitionMarketEntry("COMPLETED", "IN_PROGRESS")).toBe(false);
  });
});
