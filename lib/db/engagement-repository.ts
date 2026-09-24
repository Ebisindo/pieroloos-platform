import { prisma } from "@/lib/db/prisma";

export const engagementRepository = {
  async findById(id: string) {
    return prisma.engagement.findUnique({
      where: { id },
      include: {
        client: { include: { businessProfile: true } },
        activities: { orderBy: { createdAt: "desc" } },
      },
    });
  },

  async listByClient(clientId: string) {
    return prisma.engagement.findMany({
      where: { clientId },
      orderBy: { updatedAt: "desc" },
      include: { activities: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
  },

  async create(data: {
    clientId: string; service: string; ownerId?: string;
    nextAction?: string; notes?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const engagement = await tx.engagement.create({
        data: { ...data, status: "INTAKE" },
      });
      await tx.activity.create({
        data: {
          engagementId: engagement.id,
          type: "CREATED",
          title: "Engagement created",
          description: `Engagement opened for ${data.service}.`,
          actorId: data.ownerId,
        },
      });
      return engagement;
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    return prisma.engagement.update({ where: { id }, data });
  },
};
