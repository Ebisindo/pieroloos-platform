import type { OperationalSignal } from "./operational-intelligence";
import { derivePriorityFromSignalSeverity } from "./escalation-engine";
import type { OperationalAction } from "./action-control";

export function actionFromSignal(input: {
  signal: OperationalSignal;
  organizationId: string;
  workspaceId: string;
  createdByUserId: string;
  dueAt?: Date;
  now?: Date;
}): OperationalAction {
  const now = input.now ?? new Date();

  return {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    title: input.signal.title,
    description: input.signal.description,
    sourceSignalId: input.signal.id,
    documentId: input.signal.entityId,
    complianceObligationId: input.signal.obligationId,
    createdByUserId: input.createdByUserId,
    priority: derivePriorityFromSignalSeverity(input.signal.severity),
    status: "OPEN",
    dueAt: input.dueAt,
    escalationLevel: 0,
    createdAt: now,
    updatedAt: now,
  };
}
