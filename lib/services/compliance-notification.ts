export type ComplianceNotification = {
  id: string;
  obligationId: string;
  recipientUserId: string;
  channel: "IN_APP" | "EMAIL";
  subject: string;
  body: string;
  scheduledFor: Date;
  status: "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
};

export type NotificationDispatcher = {
  enqueue(notification: Omit<ComplianceNotification, "id" | "status">): Promise<void>;
};

export async function queueComplianceNotification(
  dispatcher: NotificationDispatcher,
  input: Omit<ComplianceNotification, "id" | "status">,
) {
  return dispatcher.enqueue(input);
}
