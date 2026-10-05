export type ControlActionStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "PENDING_REVIEW"
  | "RESOLVED"
  | "CANCELLED";

export type ActionPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type EscalationLevel = 0 | 1 | 2 | 3;

export type OperationalAction = {
  id: string;
  organizationId: string;
  workspaceId: string;
  title: string;
  description?: string;
  sourceSignalId?: string;
  clientId?: string;
  engagementId?: string;
  documentId?: string;
  complianceObligationId?: string;
  assigneeUserId?: string;
  createdByUserId: string;
  priority: ActionPriority;
  status: ControlActionStatus;
  dueAt?: Date;
  escalationLevel: EscalationLevel;
  escalationAt?: Date;
  resolvedAt?: Date;
  resolutionNote?: string;
  createdAt: Date;
  updatedAt: Date;
};

export const ACTION_TRANSITIONS: Record<ControlActionStatus, ControlActionStatus[]> = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "PENDING_REVIEW", "RESOLVED", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  PENDING_REVIEW: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: [],
  CANCELLED: [],
};

export function canTransitionAction(
  from: ControlActionStatus,
  to: ControlActionStatus,
) {
  return ACTION_TRANSITIONS[from].includes(to);
}

export function transitionAction(
  action: OperationalAction,
  to: ControlActionStatus,
  now = new Date(),
): OperationalAction {
  if (to === "RESOLVED") {
    throw new Error("Actions must be resolved with a resolution note.");
  }
  if (!canTransitionAction(action.status, to)) {
    throw new Error(`Invalid action transition: ${action.status} -> ${to}`);
  }

  return {
    ...action,
    status: to,
    updatedAt: now,
    resolvedAt: action.resolvedAt,
  };
}

export function resolveAction(
  action: OperationalAction,
  resolutionNote: string,
  now = new Date(),
): OperationalAction {
  if (!resolutionNote.trim()) {
    throw new Error("A resolution note is required.");
  }
  if (!canTransitionAction(action.status, "RESOLVED")) {
    throw new Error(`Invalid action transition: ${action.status} -> RESOLVED`);
  }

  return {
    ...action,
    status: "RESOLVED",
    updatedAt: now,
    resolutionNote: resolutionNote.trim(),
    resolvedAt: now,
  };
}
