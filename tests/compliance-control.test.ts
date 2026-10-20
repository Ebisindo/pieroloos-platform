import { describe, expect, it } from "vitest";
import { buildComplianceControlSnapshot } from "@/lib/domain/compliance-control";
import { evaluateEscalation } from "@/lib/domain/escalation";

describe("compliance control center", () => {
  const now = new Date("2026-02-01T00:00:00Z");

  it("classifies overdue obligations as critical alerts", () => {
    const snapshot = buildComplianceControlSnapshot([{
      id: "o1",
      clientId: "c1",
      title: "Annual filing",
      status: "IN_PROGRESS",
      dueAt: new Date("2026-01-20T00:00:00Z"),
    }], now);

    expect(snapshot.totals.overdue).toBe(1);
    expect(snapshot.alerts[0].urgency).toBe("CRITICAL");
    expect(snapshot.portfolioStatus).toBe("OVERDUE");
  });

  it("escalates blocked obligations", () => {
    const decision = evaluateEscalation({
      id: "a",
      obligationId: "o",
      clientId: "c",
      title: "Blocked item",
      urgency: "CRITICAL",
      status: "BLOCKED",
      dueAt: null,
      daysUntilDue: null,
      requiresEvidence: false,
      requiresProfessionalReview: false,
      escalationLevel: 0,
    }, {
      id: "p",
      name: "Default",
      enabled: true,
      overdueAfterDays: 3,
      maxLevel: 3,
      notifyChannels: ["IN_APP"],
    });

    expect(decision.shouldEscalate).toBe(true);
    expect(decision.nextLevel).toBe(1);
  });
});
