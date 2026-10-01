import { prisma } from "@/lib/db/prisma";
import type { ActivityType } from "@prisma/client";

export const activityRepository = {
  async listByEngagement(engagementId: string) {
    return prisma.activity.findMany({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: {
    engagementId?: string;
    workspaceId?: string;
    type: ActivityType | string;
    title: string;
    summary?: string;
    description?: string;
    actorId?: string;
  }) {
    return prisma.activity.create({
      data: {
        engagementId: data.engagementId,
        workspaceId: data.workspaceId ?? "workspace-placeholder",
        type: data.type as ActivityType,
        title: data.title,
        summary: data.summary,
        description: data.description,
        actorId: data.actorId,
      },
    });
  },
};
