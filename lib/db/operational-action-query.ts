import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";
import type { OperationalAction, EscalationLevel } from "@/lib/domain/action-control";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export function mapOperationalAction(record: Prisma.OperationalActionGetPayload<{}>): OperationalAction {
  return {
    id: record.id,
    organizationId: record.organizationId,
    workspaceId: record.workspaceId,
    title: record.title,
    description: record.description ?? undefined,
    sourceSignalId: record.sourceSignalId ?? undefined,
    clientId: record.clientId ?? undefined,
    engagementId: record.engagementId ?? undefined,
    documentId: record.documentId ?? undefined,
    complianceObligationId: record.complianceObligationId ?? undefined,
    assigneeUserId: record.assigneeUserId ?? undefined,
    createdByUserId: record.createdByUserId,
    priority: record.priority,
    status: record.status,
    dueAt: record.dueAt ?? undefined,
    escalationLevel: record.escalationLevel as EscalationLevel,
    escalationAt: record.escalationAt ?? undefined,
    resolvedAt: record.resolvedAt ?? undefined,
    resolutionNote: record.resolutionNote ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function listActiveOperationalActions(principal: WorkspacePrincipal) {
  assertPermission(principal, "compliance:read");

  const records = await prisma.operationalAction.findMany({
    where: {
      organizationId: principal.organizationId,
      workspaceId: principal.workspaceId,
      status: { notIn: ["RESOLVED", "CANCELLED"] },
    },
    orderBy: [
      { priority: "desc" },
      { dueAt: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
    take: 8,
  });

  return records.map(mapOperationalAction);
}