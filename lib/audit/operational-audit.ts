export type OperationalAuditAction =
  | "COMMAND_CENTER_VIEWED" | "EVIDENCE_SIGNAL_ACKNOWLEDGED" | "EVIDENCE_ESCALATED"
  | "REPORT_EVIDENCE_INCLUDED" | "REPORT_EVIDENCE_EXCLUDED" | "DOCUMENT_ACCESS_DENIED";

export type OperationalAuditEvent = {
  organizationId: string; workspaceId: string; actorUserId: string;
  action: OperationalAuditAction; entityType: string; entityId?: string;
  metadata?: Record<string, unknown>; occurredAt: Date;
};

export interface OperationalAuditRepository {
  append(event: OperationalAuditEvent): Promise<void>;
}
