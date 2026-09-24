import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

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
    clientId: string;
    service: string;
    ownerId?: string;
    nextAction?: string;
    notes?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findUniqueOrThrow({
        where: { id: data.clientId },
        select: { workspaceId: true },
      });

      const engagement = await tx.engagement.create({
        data: {
          workspaceId: client.workspaceId,
          clientId: data.clientId,
          service: data.service,
          status: "DRAFT",
          nextAction: data.nextAction,
          notes: data.notes,
        },
      });

      await tx.activity.create({
        data: {
          engagementId: engagement.id,
          type: "CREATED",
          summary: `Engagement opened for ${data.service}.`,
        },
      });

      return engagement;
    });
  },

  async update(id: string, data: Prisma.EngagementUpdateInput) {
    return prisma.engagement.update({ where: { id }, data });
  },
};
