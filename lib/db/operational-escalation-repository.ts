import { prisma } from "@/lib/db/prisma";
import { mapOperationalAction } from "@/lib/db/operational-action-query";
import type { EscalationCommit, EscalationRepository } from "@/lib/services/escalation-service";

export const operationalEscalationRepository: EscalationRepository = {
  async findDueActions(input) {
    const records = await prisma.operationalAction.findMany({
      where: {
        status: { notIn: ["RESOLVED", "CANCELLED"] },
        dueAt: { lt: input.now },
        escalationLevel: { lt: 3 },
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: 500,
    });
    return records.map(mapOperationalAction);
  },

  async commitEscalation({ action, event, notification }: EscalationCommit) {
    return prisma.$transaction(async (transaction) => {
      const claimed = await transaction.operationalAction.updateMany({
        where: {
          id: action.id,
          organizationId: action.organizationId,
          workspaceId: action.workspaceId,
          status: action.status,
          escalationLevel: action.escalationLevel,
          updatedAt: action.updatedAt,
          dueAt: { lt: event.occurredAt },
        },
        data: {
          escalationLevel: event.toLevel,
          escalationAt: event.occurredAt,
          updatedAt: event.occurredAt,
        },
      });
      if (claimed.count === 0) return false;

      await transaction.operationalEscalationEvent.create({
        data: {
          organizationId: action.organizationId,
          workspaceId: action.workspaceId,
          actionId: event.actionId,
          fromLevel: event.fromLevel,
          toLevel: event.toLevel,
          reason: event.reason,
          occurredAt: event.occurredAt,
        },
      });

      await transaction.complianceNotification.upsert({
        where: {
          organizationId_workspaceId_dedupeKey: {
            organizationId: notification.organizationId,
            workspaceId: notification.workspaceId,
            dedupeKey: notification.dedupeKey,
          },
        },
        create: {
          organizationId: notification.organizationId,
          workspaceId: notification.workspaceId,
          obligationId: notification.obligationId,
          actionId: notification.actionId,
          recipientUserId: notification.recipientUserId,
          channel: notification.channel,
          subject: notification.subject,
          body: notification.body,
          scheduledFor: notification.scheduledFor,
          status: "QUEUED",
          dedupeKey: notification.dedupeKey,
        },
        update: {},
      });

      return true;
    });
  },
};
