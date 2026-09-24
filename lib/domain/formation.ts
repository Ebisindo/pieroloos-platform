export const FORMATION_PLAN_STATUSES = [
  "DRAFT", "READY", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED",
] as const;
export type FormationPlanStatus = typeof FORMATION_PLAN_STATUSES[number];

export const FORMATION_STAGE_STATUSES = [
  "PENDING", "READY", "IN_PROGRESS", "BLOCKED", "COMPLETED", "SKIPPED",
] as const;
export type FormationStageStatus = typeof FORMATION_STAGE_STATUSES[number];

export const FORMATION_TASK_STATUSES = [
  "PENDING", "READY", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "COMPLETED", "WAIVED",
] as const;
export type FormationTaskStatus = typeof FORMATION_TASK_STATUSES[number];

export type EvidenceRequirement = {
  key: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  evidenceId?: string;
};

export type FormationTask = {
  id: string;
  key: string;
  title: string;
  description: string;
  status: FormationTaskStatus;
  order: number;
  dependsOnTaskKeys: string[];
  evidenceRequirements: EvidenceRequirement[];
  requiresProfessionalReview: boolean;
  reviewCompleted: boolean;
  ownerUserId?: string;
  blockingReason?: string;
  dueDate?: string;
};

export type FormationStage = {
  id: string;
  key: string;
  title: string;
  description: string;
  order: number;
  status: FormationStageStatus;
  tasks: FormationTask[];
};

export type FormationPlan = {
  id: string;
  clientId: string;
  businessProfileId: string;
  comparisonSnapshotId: string;
  workingJurisdictionDecisionId: string;
  jurisdictionId: string;
  jurisdictionName: string;
  methodologyVersion: string;
  status: FormationPlanStatus;
  stages: FormationStage[];
  createdAt: string;
  updatedAt: string;
};

export type WorkingJurisdictionDecision = {
  id: string;
  businessProfileId: string;
  comparisonSnapshotId: string;
  jurisdictionId: string;
  rationale?: string;
  decidedByUserId: string;
  decidedAt: string;
  professionalReviewRequired: boolean;
  professionalReviewCompleted: boolean;
};

export function taskDependenciesSatisfied(task: FormationTask, tasks: FormationTask[]) {
  return task.dependsOnTaskKeys.every((key) => {
    const dependency = tasks.find((item) => item.key === key);
    return dependency?.status === "COMPLETED" || dependency?.status === "WAIVED";
  });
}

export function evidenceSatisfied(task: FormationTask) {
  return task.evidenceRequirements.filter((item) => item.required).every((item) => item.satisfied);
}

export function taskCanComplete(task: FormationTask, tasks: FormationTask[]) {
  return taskDependenciesSatisfied(task, tasks)
    && evidenceSatisfied(task)
    && (!task.requiresProfessionalReview || task.reviewCompleted);
}

export function refreshTaskReadiness(task: FormationTask, tasks: FormationTask[]): FormationTask {
  if (["COMPLETED", "WAIVED"].includes(task.status)) return task;

  if (!taskDependenciesSatisfied(task, tasks)) {
    return { ...task, status: "BLOCKED", blockingReason: "One or more prerequisite tasks are incomplete." };
  }

  if (task.evidenceRequirements.some((item) => item.required && !item.satisfied)) {
    return { ...task, status: "BLOCKED", blockingReason: "Required evidence is incomplete." };
  }

  if (task.requiresProfessionalReview && !task.reviewCompleted) {
    return { ...task, status: "IN_REVIEW", blockingReason: "Professional review is required before completion." };
  }

  return { ...task, status: "READY", blockingReason: undefined };
}
