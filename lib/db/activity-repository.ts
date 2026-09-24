import { prisma } from "@/lib/db/prisma";

export const activityRepository = {
  async listByEngagement(engagementId: string) {
    return prisma.activity.findMany({
      where: { engagementId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: {
    engagementId: string; type: string; title: string;
    description?: string; actorId?: string;
  }) {
    return prisma.activity.create({ data });
  },
};
