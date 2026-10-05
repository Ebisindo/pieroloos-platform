export const MARKET_ENTRY_STATUSES = ["ASSESSING", "IN_PROGRESS", "PAUSED", "COMPLETED"] as const;
export type MarketEntryStatus = typeof MARKET_ENTRY_STATUSES[number];

export const MARKET_ENTRY_REVIEW_STATUSES = ["PENDING", "APPROVED", "CHANGES_REQUESTED"] as const;
export type MarketEntryReviewStatus = typeof MARKET_ENTRY_REVIEW_STATUSES[number];

export type ReadinessCheckStatus =
  | "COMPLETE"
  | "IN_PROGRESS"
  | "NEEDS_INPUT"
  | "NOT_CONFIGURED"
  | "REVIEW_REQUIRED"
  | "NOT_ASSESSED";

export type ReadinessCheck = {
  key: string;
  title: string;
  status: ReadinessCheckStatus;
  summary: string;
  completed?: number;
  total?: number;
  nextSteps: string[];
};

export type MarketReadiness = {
  status: "PREPARATION_INCOMPLETE" | "READY_FOR_REVIEW" | "REVIEW_RECORDED" | "CHANGES_REQUESTED";
  checks: ReadinessCheck[];
  assessedAt: string;
  boundary: string;
};

export function assessMarketReadiness(input: {
  profile: {
    businessName: string | null;
    businessType: string | null;
    businessObjective: string | null;
    businessModel: string | null;
    targetMarket: string | null;
    revenueModel: string | null;
    ownershipContext: string | null;
  };
  formationPlan?: {
    taskStatuses: string[];
    taskCount: number;
  } | null;
  obligations: Array<{
    status: string;
    requiresEvidence: boolean;
    evidenceCount: number;
  }>;
  reviewStatus: MarketEntryReviewStatus;
  assessedAt?: Date;
}): MarketReadiness {
  const profileFields = [
    ["business name", input.profile.businessName],
    ["business type", input.profile.businessType],
    ["business objective", input.profile.businessObjective],
    ["business model", input.profile.businessModel],
    ["target market", input.profile.targetMarket],
    ["revenue model", input.profile.revenueModel],
    ["ownership context", input.profile.ownershipContext],
  ] as const;
  const missingProfileFields = profileFields
    .filter(([, value]) => !value?.trim())
    .map(([label]) => label);

  const profileCheck: ReadinessCheck = {
    key: "business-profile",
    title: "Business profile",
    status: missingProfileFields.length ? "NEEDS_INPUT" : "COMPLETE",
    summary: missingProfileFields.length
      ? `${missingProfileFields.length} core profile fields are missing.`
      : "Core business profile fields are recorded.",
    completed: profileFields.length - missingProfileFields.length,
    total: profileFields.length,
    nextSteps: missingProfileFields.length
      ? [`Complete: ${missingProfileFields.join(", ")}.`]
      : [],
  };

  const completedTaskCount = input.formationPlan?.taskStatuses
    .filter((status) => ["COMPLETED", "WAIVED"].includes(status)).length ?? 0;
  const formationCheck: ReadinessCheck = !input.formationPlan
    ? {
        key: "formalization",
        title: "Formalization plan",
        status: "NOT_CONFIGURED",
        summary: "No formation plan is linked to this market-entry pathway.",
        nextSteps: ["Create and link a formation plan from a saved jurisdiction comparison."],
      }
    : {
        key: "formalization",
        title: "Formalization plan",
        status: completedTaskCount === input.formationPlan.taskCount && input.formationPlan.taskCount > 0
          ? "COMPLETE"
          : "IN_PROGRESS",
        summary: `${completedTaskCount} of ${input.formationPlan.taskCount} formation tasks are complete.`,
        completed: completedTaskCount,
        total: input.formationPlan.taskCount,
        nextSteps: completedTaskCount === input.formationPlan.taskCount && input.formationPlan.taskCount > 0
          ? []
          : ["Continue the linked formation tasks and satisfy their evidence and professional-review gates."],
      };

  const obligationCount = input.obligations.length;
  const completedObligations = input.obligations.filter((obligation) =>
    ["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"].includes(obligation.status),
  ).length;
  const obligationCheck: ReadinessCheck = {
    key: "obligations",
    title: "Recorded obligations",
    status: obligationCount === 0
      ? "NOT_CONFIGURED"
      : completedObligations === obligationCount ? "COMPLETE" : "IN_PROGRESS",
    summary: obligationCount === 0
      ? "No obligations are recorded for this profile and target jurisdiction."
      : `${completedObligations} of ${obligationCount} recorded obligations are complete or explicitly not applicable.`,
    completed: completedObligations,
    total: obligationCount,
    nextSteps: obligationCount === 0
      ? ["Have a qualified professional identify and record applicable obligations."]
      : completedObligations === obligationCount
        ? []
        : ["Review and update each open obligation with the responsible professional."],
  };

  const evidenceRequired = input.obligations.filter((obligation) => obligation.requiresEvidence);
  const evidenceCovered = evidenceRequired.filter((obligation) => obligation.evidenceCount > 0).length;
  const evidenceCheck: ReadinessCheck = {
    key: "obligation-evidence",
    title: "Obligation evidence",
    status: evidenceRequired.length === 0
      ? obligationCount === 0 ? "NOT_CONFIGURED" : "COMPLETE"
      : evidenceCovered === evidenceRequired.length ? "COMPLETE" : "NEEDS_INPUT",
    summary: evidenceRequired.length === 0
      ? obligationCount === 0
        ? "Evidence coverage cannot be assessed until obligations are recorded."
        : "No recorded obligation currently requires evidence."
      : `${evidenceCovered} of ${evidenceRequired.length} evidence-requiring obligations have linked evidence.`,
    completed: evidenceCovered,
    total: evidenceRequired.length,
    nextSteps: evidenceRequired.length > evidenceCovered
      ? ["Attach and review evidence for each obligation that requires it."]
      : [],
  };

  const reviewCheck: ReadinessCheck = {
    key: "professional-review",
    title: "Professional review",
    status: input.reviewStatus === "APPROVED"
      ? "COMPLETE"
      : input.reviewStatus === "CHANGES_REQUESTED" ? "NEEDS_INPUT" : "REVIEW_REQUIRED",
    summary: input.reviewStatus === "APPROVED"
      ? "A reviewer recorded an internal review outcome."
      : input.reviewStatus === "CHANGES_REQUESTED"
        ? "The reviewer requested changes before the pathway progresses."
        : "A qualified professional must review the pathway.",
    nextSteps: input.reviewStatus === "APPROVED"
      ? []
      : [input.reviewStatus === "CHANGES_REQUESTED"
        ? "Address reviewer feedback and request another review."
        : "Assign a qualified professional to review jurisdiction assumptions and applicable requirements."],
  };

  const operationsCheck: ReadinessCheck = {
    key: "cross-border-operations",
    title: "Cross-border operating controls",
    status: "NOT_ASSESSED",
    summary: "Payment corridors, banking, trade controls, tax treatment, data transfers, and counterparties are not assessed by this workflow.",
    nextSteps: ["Assess applicable cross-border operating controls with qualified local professionals before transacting."],
  };

  const checks = [profileCheck, formationCheck, obligationCheck, evidenceCheck, reviewCheck, operationsCheck];
  const preparationChecks = [profileCheck, formationCheck, obligationCheck, evidenceCheck];
  const preparationComplete = preparationChecks.every((check) => check.status === "COMPLETE");
  const status = !preparationComplete
    ? "PREPARATION_INCOMPLETE"
    : input.reviewStatus === "CHANGES_REQUESTED"
      ? "CHANGES_REQUESTED"
      : input.reviewStatus === "APPROVED"
        ? "REVIEW_RECORDED"
        : "READY_FOR_REVIEW";

  return {
    status,
    checks,
    assessedAt: (input.assessedAt ?? new Date()).toISOString(),
    boundary: "This is an internal preparation checklist, not a legal, tax, regulatory, banking, licensing, market-suitability, or transaction approval. Recorded data may be incomplete or out of date.",
  };
}

export function canTransitionMarketEntry(from: MarketEntryStatus, to: MarketEntryStatus) {
  const transitions: Record<MarketEntryStatus, MarketEntryStatus[]> = {
    ASSESSING: ["IN_PROGRESS", "PAUSED"],
    IN_PROGRESS: ["PAUSED", "COMPLETED"],
    PAUSED: ["ASSESSING", "IN_PROGRESS"],
    COMPLETED: [],
  };
  return transitions[from].includes(to);
}
