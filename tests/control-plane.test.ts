import { describe, expect, it } from "vitest";
import { transitionAction, resolveAction, type OperationalAction } from "@/lib/domain/action-control";
import { assessEscalation } from "@/lib/domain/escalation-engine";

const base: OperationalAction = {
  id: "a1",
  organizationId: "org1",
  workspaceId: "ws1",
  title: "Replace rejected evidence",
  sourceSignalId: "rejected:d1",
  createdByUserId: "u1",
  priority: "CRITICAL",
  status: "OPEN",
  escalationLevel: 0,
  dueAt: new Date("2026-09-20T12:00:00Z"),
  createdAt: new Date("2026-09-19T12:00:00Z"),
  updatedAt: new Date("2026-09-19T12:00:00Z"),
};

describe("Session 12 control plane", () => {
  it("enforces the action lifecycle", () => {
    const assigned = transitionAction(base, "ASSIGNED");
    const started = transitionAction(assigned, "IN_PROGRESS");
    expect(started.status).toBe("IN_PROGRESS");
    expect(() => transitionAction(base, "RESOLVED")).toThrow();
  });

  it("requires a resolution note", () => {
    const started = transitionAction(base, "ASSIGNED");
    const inProgress = transitionAction(started, "IN_PROGRESS");
    expect(() => resolveAction(inProgress, " ")).toThrow();
    expect(resolveAction(inProgress, "Replacement evidence uploaded").status).toBe("RESOLVED");
  });

  it("raises escalation when a critical action passes the threshold", () => {
    const assessment = assessEscalation(base, new Date("2026-09-26T13:00:00Z"));
    expect(assessment.shouldEscalate).toBe(true);
    expect(assessment.nextLevel).toBeGreaterThan(0);
  });
});
