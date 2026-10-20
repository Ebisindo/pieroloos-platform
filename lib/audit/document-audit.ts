export type DocumentAuditAction =
  | "UPLOADED"
  | "VERSION_CREATED"
  | "VIEWED"
  | "DOWNLOADED"
  | "REVIEW_STARTED"
  | "VERIFIED"
  | "REJECTED"
  | "SUPERSEDED"
  | "LINKED"
  | "UNLINKED";

export type DocumentAuditEvent = {
  organizationId: string;
  documentId: string;
  actorUserId: string;
  action: DocumentAuditAction;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
};

export interface DocumentAuditRepository {
  append(event: DocumentAuditEvent): Promise<void>;
}
