import type { OperationalAction } from "@/lib/domain/action-control";

export type ComplianceNotification = {
  id: string;
  organizationId: string;
  workspaceId: string;
  obligationId?: string;
  actionId?: string;
  recipientUserId?: string;
  channel: "IN_APP" | "EMAIL";
  subject: string;
  body: string;
  scheduledFor: Date;
  status: "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
  dedupeKey: string;
  createdAt?: Date;
  sentAt?: Date;
  failedAt?: Date;
  failureReason?: string;
};

export type NotificationDispatcher = {
  enqueue(notification: Omit<ComplianceNotification, "id" | "status"> & { id?: string; status?: ComplianceNotification["status"] }): Promise<void>;
  findByDedupeKey?(dedupeKey: string): Promise<ComplianceNotification | null>;
};

export function buildEscalationNotification(
  action: OperationalAction,
  level: number,
  now = new Date(),
): Omit<ComplianceNotification, "id" | "status"> & { id?: string; status?: ComplianceNotification["status"] } {
  const recipientUserId = action.assigneeUserId ?? action.createdByUserId;

  return {
    organizationId: action.organizationId,
    workspaceId: action.workspaceId,
    actionId: action.id,
    obligationId: action.complianceObligationId ?? action.id,
    recipientUserId,
    channel: "IN_APP",
    subject: `Action escalated to level ${level}`,
    body: `Action "${action.title}" has escalated to level ${level}.`,
    scheduledFor: now,
    dedupeKey: `escalation:${action.id}:${level}`,
  };
}

export async function queueComplianceNotification(
  dispatcher: NotificationDispatcher,
  input: Omit<ComplianceNotification, "id" | "status"> & { id?: string; status?: ComplianceNotification["status"] },
): Promise<ComplianceNotification> {
  const dedupeKey = input.dedupeKey ?? `${input.obligationId}:${input.recipientUserId}:${input.channel}:${input.subject}`;
  const existing = dispatcher.findByDedupeKey ? await dispatcher.findByDedupeKey(dedupeKey) : null;

  if (existing) {
    return existing;
  }

  const notification: ComplianceNotification = {
    id: input.id ?? `notification-${crypto.randomUUID()}`,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    obligationId: input.obligationId,
    actionId: input.actionId,
    recipientUserId: input.recipientUserId,
    channel: input.channel,
    subject: input.subject,
    body: input.body,
    scheduledFor: input.scheduledFor,
    status: input.status ?? "QUEUED",
    dedupeKey,
  };

  await dispatcher.enqueue(notification);
  return notification;
}
