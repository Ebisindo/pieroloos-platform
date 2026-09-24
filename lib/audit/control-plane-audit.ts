import type { OperationalAuditRepository } from "@/lib/audit/operational-audit";

export async function auditControlAction(
  audit: OperationalAuditRepository,
  input: {
    organizationId: string;
    workspaceId: string;
    actorUserId: string;
    action: "ACTION_CREATED" | "ACTION_ASSIGNED" | "ACTION_STARTED" | "ACTION_BLOCKED" | "ACTION_RESOLVED" | "ACTION_ESCALATED";
    actionId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await audit.append({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "EVIDENCE_SIGNAL_ACKNOWLEDGED",
    entityType: "OperationalAction",
    entityId: input.actionId,
    metadata: { controlAction: input.action, ...input.metadata },
    occurredAt: new Date(),
  });
}
