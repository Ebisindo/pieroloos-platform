import { describe, expect, it } from "vitest";
import {
  evidenceSatisfied,
  taskCanComplete,
  taskDependenciesSatisfied,
  type FormationTask,
} from "@/lib/domain/formation";
import { createFormationPlan } from "@/lib/services/formation-engine";

const task = (overrides: Partial<FormationTask> = {}): FormationTask => ({
  id: "task",
  key: "task",
  title: "Task",
  description: "Task",
  status: "READY",
  order: 10,
  dependsOnTaskKeys: [],
  evidenceRequirements: [],
  requiresProfessionalReview: false,
  reviewCompleted: false,
  ...overrides,
});

describe("formation operations engine", () => {
  it("blocks incomplete dependencies", () => {
    const dependency = task({ id: "dependency", key: "dependency", status: "IN_PROGRESS" });
    const current = task({ dependsOnTaskKeys: ["dependency"] });

    expect(taskDependenciesSatisfied(current, [dependency, current])).toBe(false);
  });

  it("requires evidence", () => {
    const current = task({
      evidenceRequirements: [
        { key: "proof", label: "Proof", required: true, satisfied: false },
      ],
    });

    expect(evidenceSatisfied(current)).toBe(false);
    expect(taskCanComplete(current, [current])).toBe(false);
  });

  it("requires professional review", () => {
    const current = task({ requiresProfessionalReview: true, reviewCompleted: false });
    expect(taskCanComplete(current, [current])).toBe(false);
  });

  it("generates a multi-stage formation plan from an explicit decision", () => {
    const plan = createFormationPlan({
      id: "plan-1",
      clientId: "client-1",
      businessProfileId: "profile-1",
      comparisonSnapshotId: "snapshot-1",
      decision: {
        id: "decision-1",
        businessProfileId: "profile-1",
        comparisonSnapshotId: "snapshot-1",
        jurisdictionId: "us-new-mexico",
        decidedByUserId: "user-1",
        decidedAt: new Date().toISOString(),
        professionalReviewRequired: true,
        professionalReviewCompleted: false,
      },
      jurisdictionName: "United States — New Mexico",
      methodologyVersion: "1.0",
    });

    expect(plan.stages.length).toBeGreaterThanOrEqual(4);
    expect(plan.jurisdictionId).toBe("us-new-mexico");
  });
});
