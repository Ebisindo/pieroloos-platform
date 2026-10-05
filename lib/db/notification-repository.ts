import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { assertPermission, assertSameWorkspace, type WorkspacePrincipal } from "@/lib/auth/workspace-access";
import type { ComplianceNotification } from "@/lib/services/compliance-notification";

export type NotificationRecordInput = Omit<ComplianceNotification, "id" | "status"> & {
  id?: string;
  status?: ComplianceNotification["status"];
  organizationId: string;
  workspaceId: string;
};

function mapRecord(record: Prisma.ComplianceNotificationGetPayload<object>): ComplianceNotification {
  return {
    id: record.id,
    organizationId: record.organizationId,
    workspaceId: record.workspaceId,
    obligationId: record.obligationId ?? undefined,
    actionId: record.actionId ?? undefined,
    recipientUserId: record.recipientUserId ?? undefined,
    channel: record.channel,
    subject: record.subject,
    body: record.body,
    scheduledFor: record.scheduledFor,
    status: record.status,
    dedupeKey: record.dedupeKey,
    createdAt: record.createdAt,
    sentAt: record.sentAt ?? undefined,
    failedAt: record.failedAt ?? undefined,
    failureReason: record.failureReason ?? undefined,
  };
}

export const notificationRepository = {
  async listForRecipient(principal: WorkspacePrincipal) {
    assertPermission(principal, "compliance:read");

    const records = await prisma.complianceNotification.findMany({
      where: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        recipientUserId: principal.userId,
        channel: "IN_APP",
        status: { not: "CANCELLED" },
        scheduledFor: { lte: new Date() },
      },
      orderBy: { scheduledFor: "desc" },
      take: 10,
    });

    return records.map(mapRecord);
  },

  async findByDedupeKey(dedupeKey: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "compliance:read");

    const record = await prisma.complianceNotification.findFirst({
      where: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        dedupeKey,
      },
    });

    if (!record) return null;
    return mapRecord(record);
  },

  async enqueue(input: NotificationRecordInput, principal: WorkspacePrincipal) {
    assertPermission(principal, "compliance:write");
    assertSameWorkspace(principal, input);

    const data = {
      id: input.id ?? undefined,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      obligationId: input.obligationId ?? null,
      actionId: input.actionId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      channel: input.channel,
      subject: input.subject,
      body: input.body,
      scheduledFor: input.scheduledFor,
      status: input.status ?? "QUEUED",
      dedupeKey: input.dedupeKey,
    };
    const record = await prisma.complianceNotification.upsert({
      where: {
        organizationId_workspaceId_dedupeKey: {
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          dedupeKey: input.dedupeKey,
        },
      },
      create: data,
      update: {},
    });

    return mapRecord(record);
  },
};
