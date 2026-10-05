import { prisma } from "./prisma";
import type { ComplianceStatus } from "@prisma/client";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";

export const complianceRepository = {
  async listByEngagement(engagementId: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "compliance:read");
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, workspaceId: principal.workspaceId },
      select: { id: true },
    });
    if (!engagement) throw new Error("ENGAGEMENT_NOT_FOUND");
    return prisma.complianceItem.findMany({
      where: { engagementId, workspaceId: principal.workspaceId },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    });
  },

  create(input: {
    clientId?: string;
    engagementId?: string;
    category: string;
    title: string;
    jurisdiction?: string;
    dueAt?: Date;
    status?: ComplianceStatus;
  }, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      const [client, engagement] = await Promise.all([
        input.clientId
          ? transaction.client.findFirst({
              where: { id: input.clientId, workspaceId: principal.workspaceId },
              select: { id: true },
            })
          : null,
        input.engagementId
          ? transaction.engagement.findFirst({
              where: { id: input.engagementId, workspaceId: principal.workspaceId },
              select: { id: true, clientId: true },
            })
          : null,
      ]);
      if ((input.clientId && !client) || (input.engagementId && !engagement)) {
        throw new Error("COMPLIANCE_RESOURCE_NOT_FOUND");
      }
      if (client && engagement && engagement.clientId !== client.id) {
        throw new Error("COMPLIANCE_RESOURCE_MISMATCH");
      }
      const item = await transaction.complianceItem.create({
        data: {
          workspaceId: principal.workspaceId,
          clientId: client?.id ?? engagement?.clientId,
          engagementId: engagement?.id,
          category: input.category,
          title: input.title,
          jurisdiction: input.jurisdiction,
          dueAt: input.dueAt,
          status: input.status ?? "NOT_STARTED",
        },
      });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          engagementId: engagement?.id,
          actorId: principal.userId,
          type: "CREATED",
          title: "Compliance item created",
          metadata: { complianceItemId: item.id },
        },
      });
      return item;
    });
  },

  updateStatus(id: string, status: ComplianceStatus, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      const item = await transaction.complianceItem.findFirst({
        where: { id, workspaceId: principal.workspaceId },
        select: { id: true, engagementId: true, status: true },
      });
      if (!item) throw new Error("COMPLIANCE_ITEM_NOT_FOUND");
      const updated = await transaction.complianceItem.update({
        where: { id: item.id },
        data: { status },
      });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          engagementId: item.engagementId,
          actorId: principal.userId,
          type: "UPDATED",
          title: "Compliance item status updated",
          metadata: { complianceItemId: item.id, previousStatus: item.status, status },
        },
      });
      return updated;
    });
  },
};
