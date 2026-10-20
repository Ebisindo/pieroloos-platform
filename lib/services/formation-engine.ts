import type {
  FormationPlan,
  FormationStage,
  FormationTask,
  WorkingJurisdictionDecision,
} from "@/lib/domain/formation";
import { genericFormationTemplate } from "@/lib/domain/formation-template";

function createTask(
  task: (typeof genericFormationTemplate.stages)[number]["tasks"][number],
  stageKey: string,
): FormationTask {
  return {
    id: `${stageKey}:${task.key}`,
    key: task.key,
    title: task.title,
    description: task.description,
    status: "PENDING",
    order: task.order,
    dependsOnTaskKeys: task.dependsOnTaskKeys ?? [],
    evidenceRequirements: (task.evidenceRequirements ?? []).map((item) => ({
      ...item,
      satisfied: false,
    })),
    requiresProfessionalReview: task.requiresProfessionalReview ?? false,
    reviewCompleted: false,
  };
}

export function createFormationPlan(input: {
  id: string;
  clientId: string;
  businessProfileId: string;
  comparisonSnapshotId: string;
  decision: WorkingJurisdictionDecision;
  jurisdictionName: string;
  methodologyVersion: string;
  now?: string;
}): FormationPlan {
  if (!input.decision.jurisdictionId) {
    throw new Error("A working jurisdiction is required.");
  }

  const now = input.now ?? new Date().toISOString();

  const stages: FormationStage[] = genericFormationTemplate.stages.map((stage) => ({
    id: `${input.id}:${stage.key}`,
    key: stage.key,
    title: stage.title,
    description: stage.description,
    order: stage.order,
    status: "PENDING",
    tasks: stage.tasks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((task) => createTask(task, stage.key)),
  }));

  return {
    id: input.id,
    clientId: input.clientId,
    businessProfileId: input.businessProfileId,
    comparisonSnapshotId: input.comparisonSnapshotId,
    workingJurisdictionDecisionId: input.decision.id,
    jurisdictionId: input.decision.jurisdictionId,
    jurisdictionName: input.jurisdictionName,
    methodologyVersion: input.methodologyVersion,
    status: "DRAFT",
    stages,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPlanProgress(plan: FormationPlan) {
  const tasks = plan.stages.flatMap((stage) => stage.tasks);
  const completed = tasks.filter((task) => ["COMPLETED", "WAIVED"].includes(task.status)).length;
  return {
    totalTasks: tasks.length,
    completedTasks: completed,
    percentage: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
  };
}
