export const ENGAGEMENT_STATUSES = [
  "INTAKE", "ASSESSMENT", "PLANNING", "APPROVAL",
  "EXECUTION", "VERIFICATION", "RECORDING", "CLOSED",
] as const;

export type EngagementStatus = typeof ENGAGEMENT_STATUSES[number];

export const ACTIVITY_TYPES = [
  "CREATED", "UPDATED", "REVIEWED", "APPROVED",
  "COMPLETED", "COMMENTED", "STATUS_CHANGED", "DOCUMENT_ATTACHED",
] as const;

export type ActivityType = typeof ACTIVITY_TYPES[number];

const transitions: Record<EngagementStatus, EngagementStatus[]> = {
  INTAKE: ["ASSESSMENT"],
  ASSESSMENT: ["PLANNING"],
  PLANNING: ["APPROVAL"],
  APPROVAL: ["EXECUTION"],
  EXECUTION: ["VERIFICATION"],
  VERIFICATION: ["RECORDING"],
  RECORDING: ["CLOSED"],
  CLOSED: [],
};

export function canTransition(from: EngagementStatus, to: EngagementStatus) {
  return transitions[from].includes(to);
}

export function getNextStatuses(status: EngagementStatus) {
  return transitions[status];
}

export function assertTransition(from: EngagementStatus, to: EngagementStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid engagement transition: ${from} → ${to}`);
  }
}
