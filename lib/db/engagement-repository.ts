import { assertTransition, type EngagementStatus } from "@/lib/domain/engagement";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

const engagementInclude = {
  client: { include: { businessProfile: true } },
  activities: { orderBy: { createdAt: "desc" as const } },
};

export const engagementRepository = {
  async findById(id: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "engagement:read");
    return prisma.engagement.findFirst({
      where: { id, workspaceId: principal.workspaceId },
      include: engagementInclude,
    });
  },

  async listByClient(clientId: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "engagement:read");
    return prisma.engagement.findMany({
      where: { clientId, workspaceId: principal.workspaceId },
      orderBy: { updatedAt: "desc" },
      include: { activities: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
  },

  async create(
    data: { clientId: string; service: string; nextAction?: string; notes?: string },
    principal: WorkspacePrincipal,
  ) {
    return withAuthorizedWorkspaceTransaction(principal, "engagement:write", async (tx) => {
      const client = await tx.client.findFirst({
        where: { id: data.clientId, workspaceId: principal.workspaceId },
        select: { id: true },
      });
      if (!client) throw new Error("CLIENT_NOT_FOUND");

      const engagement = await tx.engagement.create({
        data: {
          workspaceId: principal.workspaceId,
          clientId: client.id,
          service: data.service,
          status: "DRAFT",
          nextAction: data.nextAction,
          notes: data.notes,
        },
      });

      await tx.activity.create({
        data: {
          engagementId: engagement.id,
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "CREATED",
          title: `Engagement opened for ${data.service}`,
          summary: `Engagement opened for ${data.service}.`,
        },
      });

      return engagement;
    });
  },

  async update(id: string, data: Prisma.EngagementUpdateInput, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "engagement:write", async (tx) => {
      const current = await tx.engagement.findFirst({
        where: { id, workspaceId: principal.workspaceId },
        select: { id: true, status: true },
      });
      if (!current) throw new Error("ENGAGEMENT_NOT_FOUND");

      const update = await tx.engagement.updateMany({
        where: { id: current.id, workspaceId: principal.workspaceId, status: current.status },
        data,
      });
      if (update.count !== 1) throw new Error("ENGAGEMENT_CHANGED_CONCURRENTLY");

      const updated = await tx.engagement.findFirst({
        where: { id: current.id, workspaceId: principal.workspaceId },
        include: engagementInclude,
      });
      if (!updated) throw new Error("ENGAGEMENT_NOT_FOUND");

      await tx.activity.create({
        data: {
          engagementId: id,
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "UPDATED",
          title: "Engagement updated",
          description: "Operational engagement details were updated.",
        },
      });

      return updated;
    });
  },

  async transition(
    id: string,
    toStatus: EngagementStatus,
    note: string | undefined,
    principal: WorkspacePrincipal,
  ) {
    return withAuthorizedWorkspaceTransaction(principal, "engagement:write", async (tx) => {
      const current = await tx.engagement.findFirst({
        where: { id, workspaceId: principal.workspaceId },
        select: { id: true, status: true },
      });
      if (!current) throw new Error("ENGAGEMENT_NOT_FOUND");

      assertTransition(current.status as EngagementStatus, toStatus);
      const update = await tx.engagement.updateMany({
        where: { id, workspaceId: principal.workspaceId, status: current.status },
        data: { status: toStatus },
      });
      if (update.count !== 1) throw new Error("ENGAGEMENT_CHANGED_CONCURRENTLY");

      const updated = await tx.engagement.findFirst({
        where: { id, workspaceId: principal.workspaceId },
        include: engagementInclude,
      });
      if (!updated) throw new Error("ENGAGEMENT_NOT_FOUND");

      await tx.activity.create({
        data: {
          engagementId: id,
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "STATUS_CHANGED",
          title: `Status changed to ${toStatus}`,
          description: note,
        },
      });
      return updated;
    });
  },
};
