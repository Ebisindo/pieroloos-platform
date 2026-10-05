import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { prisma } from "@/lib/db/prisma";
import type { ActivityType } from "@prisma/client";

export const activityRepository = {
  async listByEngagement(engagementId: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "engagement:read");
    return prisma.activity.findMany({
      where: { engagementId, workspaceId: principal.workspaceId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: {
    engagementId: string;
    type: ActivityType;
    title: string;
    summary?: string;
    description?: string;
  }, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "engagement:write", async (tx) => {
      const engagement = await tx.engagement.findFirst({
        where: { id: data.engagementId, workspaceId: principal.workspaceId },
        select: { id: true },
      });
      if (!engagement) throw new Error("ENGAGEMENT_NOT_FOUND");

      return tx.activity.create({
        data: {
          engagementId: engagement.id,
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: data.type,
          title: data.title,
          summary: data.summary,
          description: data.description,
        },
      });
    });
  },
};
